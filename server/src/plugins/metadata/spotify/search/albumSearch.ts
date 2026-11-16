import axios from 'axios';
import { withTimeout } from '../../../../utils/timeout.js';
import { cleanSearchQuery } from '../utils/queryUtils.js';
import { decodeHtmlEntities } from '../utils/htmlUtils.js';
import { searchSpotubeSpotifyTracks } from '../clients/spotifyGqlClient.js';

/**
 * Real-time search for albums across Spotify and Apple Music catalogs
 */
export async function searchAlbums(query: string, limit: number = 20): Promise<any[]> {
    const cleanQ = cleanSearchQuery(query);
    const lowerQ = cleanQ.toLowerCase();
    const results: any[] = [];
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    // Parallel fetch from Spotify and JioSaavn (time-boxed to 1000ms)
    const [spotubeRes, saavnAlbumRes] = await Promise.allSettled([
        withTimeout(searchSpotubeSpotifyTracks(cleanQ, 35), 1000),
        withTimeout(axios.get('https://www.jiosaavn.com/api.php', {
            params: {
                __call: 'search.getAlbumResults',
                _format: 'json',
                _marker: '0',
                cc: 'in',
                p: 1,
                n: 25,
                q: cleanQ
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 1000
        }), 1000)
    ]);

    // 1. Process JioSaavn Album Results
    if (saavnAlbumRes.status === 'fulfilled' && Array.isArray(saavnAlbumRes.value.data?.results)) {
        for (const item of saavnAlbumRes.value.data.results) {
            const name = decodeHtmlEntities(item.title || item.name);
            if (!name) continue;
            const norm = name.toLowerCase().trim();
            const cleanId = `saavn_alb_${item.id}`;

            if (!seenNames.has(norm) && !seenIds.has(cleanId)) {
                seenNames.add(norm);
                seenIds.add(cleanId);
                const rawImg = item.image || '';
                const hdImg = rawImg ? rawImg.replace(/150x150|50x50/, '500x500') : '';
                let artist = 'Artist';
                let artistMap = item.more_info?.artistMap;
                if (typeof artistMap === 'string') {
                    try { artistMap = JSON.parse(artistMap); } catch (e) {}
                }
                const primaryList = Array.isArray(artistMap?.primary_artists)
                    ? artistMap.primary_artists
                    : Array.isArray(artistMap?.artists)
                    ? artistMap.artists
                    : null;

                if (primaryList && primaryList.length > 0) {
                    const cleanNames = primaryList
                        .map((a: any) => {
                            if (typeof a === 'string') return a;
                            if (typeof a?.name === 'string') return a.name;
                            if (typeof a?.profile?.name === 'string') return a.profile.name;
                            return '';
                        })
                        .filter((n: string) => n && n.trim() && n !== '[object Object]');
                    if (cleanNames.length > 0) {
                        artist = decodeHtmlEntities(cleanNames.join(', '));
                    }
                }

                if (artist === 'Artist') {
                    if (typeof item.subtitle === 'string' && item.subtitle.trim() && item.subtitle !== '[object Object]') {
                        artist = decodeHtmlEntities(item.subtitle);
                    } else if (typeof item.header_desc === 'string' && item.header_desc.trim()) {
                        artist = decodeHtmlEntities(item.header_desc);
                    } else if (typeof item.artist === 'string' && item.artist.trim() && item.artist !== '[object Object]') {
                        artist = decodeHtmlEntities(item.artist);
                    } else if (typeof item.primary_artists === 'string' && item.primary_artists.trim() && item.primary_artists !== '[object Object]') {
                        artist = decodeHtmlEntities(item.primary_artists);
                    } else if (typeof item.more_info?.primary_artists === 'string' && item.more_info.primary_artists.trim()) {
                        artist = decodeHtmlEntities(item.more_info.primary_artists);
                    } else if (item.artist && typeof (item.artist as any).name === 'string') {
                        artist = (item.artist as any).name;
                    }
                }
                if (!artist || artist === '[object Object]') {
                    artist = 'Artist';
                }

                results.push({
                    id: cleanId,
                    name,
                    artists: [{ name: artist }],
                    images: hdImg ? [{ url: hdImg }] : [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=181824&color=f5d0b5&size=500&bold=true` }],
                    release_date: item.year || '2024',
                    total_tracks: Number(item.more_info?.song_pids ? item.more_info.song_pids.split(',').length : 10)
                });
            }
        }
    }

    // 2. Process Spotify GQL Tracks for authentic Spotify Album IDs & direct CDN artwork
    if (spotubeRes.status === 'fulfilled' && Array.isArray(spotubeRes.value)) {
        for (const t of spotubeRes.value) {
            const alb = t.album;
            if (!alb || !alb.name) continue;
            const norm = alb.name.toLowerCase().trim();
            const art = alb.images?.[0]?.url;
            const albumId = (t as any).albumId || t.id;

            if (!seenNames.has(norm) && !seenIds.has(albumId) && art) {
                seenNames.add(norm);
                seenIds.add(albumId);
                const albumArtists = (t.artists || []).map((a: any) => ({
                    name: typeof a === 'string' ? a : a.name || 'Artist'
                }));
                results.push({
                    id: albumId,
                    name: alb.name,
                    artists: albumArtists.length > 0 ? albumArtists : [{ name: 'Artist' }],
                    images: [{ url: art }],
                    release_date: '2024',
                    total_tracks: 10
                });
            }
        }
    }

    // Relevance scoring
    const scored = results.map(alb => {
        const aName = alb.name.toLowerCase().trim();
        const artName = (alb.artists?.[0]?.name || '').toLowerCase().trim();
        let score = 0;

        if (aName === lowerQ) score += 200;
        else if (aName.startsWith(lowerQ)) score += 150;
        else if (aName.includes(lowerQ)) score += 100;
        else if (`${aName} ${artName}`.includes(lowerQ)) score += 70;
        else if (artName.includes(lowerQ)) score += 50;
        else score += 10;

        return { alb, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.alb);
}

