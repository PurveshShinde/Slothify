import axios from 'axios';
import type { MetadataPlugin, Track, Playlist, Artist, Category } from '../interfaces.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Curated popular Spotify playlists for home / featured views & import discovery
export const POPULAR_SPOTIFY_PLAYLISTS = [
    { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits", description: "The biggest songs right now.", image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
    { id: '37i9dQZF1DX0XUsuxWHRQd', name: "RapCaviar", description: "Music from Kendrick Lamar, Drake, and more.", image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600' },
    { id: '37i9dQZF1DX4WYpdgoIcn6', name: "Chill Hits", description: "Kick back to the best new and recent chill hits.", image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600' },
    { id: '37i9dQZF1DXbYM3nMM0oPk', name: "Mega Hit Mix", description: "A mega mix of 75 favorites from the last few years.", image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600' },
    { id: '37i9dQZF1DX1lVhptIYRda', name: "Hot Country", description: "Today's top country hits.", image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600' },
    { id: '37i9dQZF1DWXRqgorJj26U', name: "Rock Classics", description: "Rock legends & epic songs.", image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600' },
    { id: '37i9dQZF1DX4sWSpwq3LiO', name: "Peaceful Piano", description: "Relax and indulge with beautiful piano pieces.", image: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=600' },
    { id: '37i9dQZF1DX76Wlfdnj7AP', name: "Beast Mode", description: "Get your beast mode on with fast-paced tracks.", image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600' },
    { id: '37i9dQZF1DX5Ejj0EkURtP', name: "All Out 2010s", description: "The biggest songs of the 2010s.", image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600' },
    { id: '37i9dQZF1DX4o1oenSJRJd', name: "All Out 2000s", description: "The biggest songs of the 2000s.", image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600' },
    { id: '37i9dQZF1DXbTxeAdrVG2l', name: "All Out 90s", description: "The biggest songs of the 1990s.", image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600' },
    { id: '37i9dQZF1DX4UtSsGT1Sbe', name: "All Out 80s", description: "The biggest songs of the 1980s.", image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600' },
    { id: '37i9dQZF1DX10zKzsJ2jva', name: "Viva Latino", description: "Today's top Latin hits.", image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600' },
    { id: '37i9dQZF1DX4dyzvuaRJ0n', name: "mint", description: "The world's biggest dance & EDM tracks.", image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600' },
    { id: '37i9dQZF1DX2TRYkJECvfC', name: "Deep House Relax", description: "Lounge and deep house grooves.", image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600' },
    { id: '37i9dQZF1DWWQRwui0ExPn', name: "Lo-Fi Beats", description: "Beats to relax, study and chill to.", image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600' },
    { id: '37i9dQZF1DWUa8ZRTfalHk', name: "Pop Rising", description: "Who's next in pop music.", image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
    { id: '37i9dQZF1DX6GwdWRQMoWS', name: "Feelin' Myself", description: "The hip-hop tracks that hit different.", image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600' },
    { id: '37i9dQZF1DX9B1hu034Dao', name: "Bedroom Pop", description: "Gentle guitars and dreamy indie bedroom pop.", image: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=600' },
    { id: '37i9dQZF1DX3YSRoSdA634', name: "Dark & Stormy", description: "Moody alternative anthems.", image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600' },
    { id: '37i9dQZF1DX3rxVfibe1L0', name: "Mood Booster", description: "Get happy with today's feel-good songs.", image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600' },
    { id: '37i9dQZF1DX0SM0LYsmbMT', name: "Jazz Classics", description: "The greatest jazz legends of all time.", image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600' },
    { id: '37i9dQZF1DX1s9knjP51Oa', name: "Calm Before The Storm", description: "Acoustic, folk, and quiet reflections.", image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600' },
    { id: '37i9dQZF1DXcfZ6moR6J06', name: "Motivation Mix", description: "Uplifting beats to push through your goals.", image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600' },
    { id: '37i9dQZF1DX4t95P6L7fBv', name: "Sad Songs", description: "Beautiful songs for heartbreak and reflection.", image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600' },
    { id: '37i9dQZF1DX2Nc3B70tvx0', name: "Ultimate Indie", description: "The best new indie and alternative tracks.", image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600' },
    { id: '37i9dQZF1DX843Qf4lrFtZ', name: "Acoustic Hits", description: "Unplugged versions of the best songs.", image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600' },
    { id: '37i9dQZF1DX0UrRvztWcAU', name: "Wake Up Happy", description: "Feel-good morning hits to start your day right.", image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600' },
    { id: '37i9dQZF1DX13ZzXoot6J0', name: "Feelin' Good", description: "Soul, funk, and uplifting classics.", image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600' },
    { id: '37i9dQZF1DX4eRPd9frC1m', name: "Baila Reggaeton", description: "The hottest reggaeton party rhythms.", image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600' },
    { id: '37i9dQZF1DX889U0CL85jj', name: "Chill R&B", description: "Smooth vocals and mellow contemporary R&B.", image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600' },
    { id: '37i9dQZF1DX3oM43CtKnRV', name: "00s Rock Anthems", description: "Rock hits from Linkin Park, Green Day and more.", image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600' },
    { id: '37i9dQZF1DXdPec7aLTmlC', name: "Happy Hits!", description: "Pure upbeat energy and catchy hooks.", image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
    { id: '37i9dQZF1DX70RN3TfWWJh', name: "Workout Hits", description: "High BPM hits for gym sessions.", image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600' },
    { id: '37i9dQZF1DXca8pP44Z4wU', name: "Coffee Table Jazz", description: "Cozy background jazz for relaxation.", image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600' },
    { id: '37i9dQZF1DX3Z9kCdf5d9Z', name: "Soft Pop Hits", description: "Gentle pop melodies and sweet vocals.", image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600' },
    { id: '37i9dQZF1DX2Ozq9f5WfF3', name: "Focus Flow", description: "Uptempo instrumental electronic music for focus.", image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600' },
    { id: '37i9dQZF1DX56b2WjW59dM', name: "Instrumental Study", description: "Soft instrumental study beats.", image: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=600' },
    { id: '37i9dQZF1DX4FPnjIRjYFG', name: "Night Rain", description: "Peaceful raindrops and ambient night tones.", image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600' },
    { id: '37i9dQZF1DWZq9h90Gq3dJ', name: "Sunset Lounge", description: "Sunset electronic and chillout beats.", image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600' },
    { id: '37i9dQZF1DWZwtERXCS82H', name: "Viral Hits", description: "Trending tracks taking over social media.", image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
    { id: '37i9dQZF1DX6Xce72jcb9Z', name: "Sing-Along Indie", description: "Indie anthems you know every word to.", image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600' },
    { id: '37i9dQZF1DX4o21t44rGv7', name: "R&B Weekly", description: "The latest R&B singles and deep cuts.", image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600' },
    { id: '37i9dQZF1DX2L0iB23Enbq', name: "Viral 50 - Global", description: "The most viral tracks across the globe.", image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600' },
    { id: '37i9dQZEVXbMDoHDwVN2tF', name: "Top 50 - Global", description: "Your daily update of the most played tracks.", image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
    { id: '37i9dQZEVXbLRQDuF5jeBp', name: "Top 50 - USA", description: "The most played tracks in the United States.", image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600' },
    { id: '37i9dQZF1DX4JAvHpjipBk', name: "New Music Friday", description: "The best new releases of the week.", image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600' },
    { id: '37i9dQZF1DXdbXrPNafg9d', name: "All Out 70s", description: "From disco to classic rock, the best of the 70s.", image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600' },
    { id: '37i9dQZF1DWV7EzJMK2FUI', name: "Jazz in the Background", description: "Soft, unobtrusive jazz vibes.", image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600' },
];

function decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function cleanSearchQuery(q: string): string {
    return q
        .replace(/\bby\b/gi, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/["'’]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export class SpotifyScraperPlugin implements MetadataPlugin {
    readonly name = 'SpotifyScraper';

    getCuratedPlaylists(limit: number = 20) {
        return POPULAR_SPOTIFY_PLAYLISTS.slice(0, limit);
    }

    /**
     * Scrape playlist data from Spotify embed
     */
    async getPlaylist(playlistId: string): Promise<Playlist> {
        try {
            const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
            const { data: html } = await axios.get<string>(url, {
                headers: { 'User-Agent': USER_AGENT }
            });

            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
            if (match && match[1]) {
                const nextData = JSON.parse(match[1]);
                const entity = nextData.props?.pageProps?.state?.data?.entity;

                if (entity) {
                    const coverArtUrl = entity.coverArt?.sources?.[0]?.url ||
                        entity.visualIdentity?.image?.[0]?.url ||
                        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

                    const tracks: Track[] = (entity.trackList || []).map((t: any, index: number) => {
                        const artistNames = (t.subtitle || 'Unknown Artist').split(/,\s*/);
                        const trackId = t.uri ? t.uri.replace('spotify:track:', '') : `scraped_${playlistId}_${index}`;

                        return {
                            id: trackId,
                            uri: t.uri || `spotify:track:${trackId}`,
                            name: t.title || 'Unknown Track',
                            artists: artistNames.map((name: string) => ({ name })),
                            album: {
                                name: entity.name || 'Unknown Album',
                                images: [{ url: coverArtUrl }]
                            },
                            duration_ms: t.duration || 180000,
                            preview_url: t.audioPreview?.url || null
                        };
                    });

                    return {
                        id: playlistId,
                        name: entity.name || entity.title || 'Playlist',
                        description: entity.description || entity.subtitle || 'Curated music playlist',
                        images: [{ url: coverArtUrl }],
                        owner: {
                            id: 'spotify',
                            display_name: 'Spotify',
                            images: [{ url: coverArtUrl }]
                        },
                        tracks: {
                            total: tracks.length,
                            items: tracks.map((track) => ({ track }))
                        }
                    };
                }
            }
        } catch (err: any) {
            console.warn(`[SpotifyScraper] Failed to scrape playlist ${playlistId}:`, err.message);
        }

        // Fallback: check curated list
        const curated = POPULAR_SPOTIFY_PLAYLISTS.find(p => p.id === playlistId);
        return {
            id: playlistId,
            name: curated?.name || 'Playlist',
            description: curated?.description || 'Curated music playlist',
            images: [{ url: curated?.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' }],
            owner: { id: 'spotify', display_name: 'Spotify' },
            tracks: { total: 0, items: [] }
        };
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const playlist = await this.getPlaylist(playlistId);
        return (playlist.tracks.items || []).map(item => item.track);
    }

    /**
     * Search tracks using Hybrid Search (JioSaavn + iTunes + Deezer):
     * - Direct JioSaavn album/song URL support
     * - JioSaavn's superior hit ranking for popular original songs
     * - HTML entity decoding
     * - Query cleaning (removes "by" keyword, e.g. "eyes dont lie by isabel larose")
     * - iTunes fallback & enrichment with smart deduplication
     */
    async searchTracks(query: string, limit: number = 20): Promise<Track[]> {
        const raw = query.trim();
        if (!raw) return [];

        // 1. Direct JioSaavn Album URL support (e.g. https://www.jiosaavn.com/album/eyes-dont-lie/k6vk9964rnM_)
        const albumMatch = raw.match(/jiosaavn\.com\/album\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (albumMatch) {
            const token = albumMatch[1];
            try {
                const aRes = await axios.get(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=album&_format=json&_marker=0&cc=in`, { timeout: 6000 });
                if (Array.isArray(aRes.data?.songs) && aRes.data.songs.length > 0) {
                    return aRes.data.songs.map((s: any) => ({
                        id: `saavn_${s.id}`,
                        uri: `spotify:track:saavn_${s.id}`,
                        name: decodeHtmlEntities(s.song || s.title),
                        artists: [{ name: decodeHtmlEntities(s.primary_artists || s.singers || aRes.data.primary_artists || 'Unknown Artist') }],
                        album: {
                            name: decodeHtmlEntities(s.album || aRes.data.title || s.song),
                            images: [{ url: (s.image || aRes.data.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(s.duration) || 180) * 1000,
                        preview_url: s.media_preview_url || null
                    }));
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] JioSaavn album URL parse failed:', err.message);
            }
        }

        // 2. Direct JioSaavn Song URL support (e.g. https://www.jiosaavn.com/song/love-me-like-you-do/NgUBWTdKB3A)
        const songMatch = raw.match(/jiosaavn\.com\/song\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (songMatch) {
            const token = songMatch[1];
            try {
                const sRes = await axios.get(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=song&_format=json&_marker=0&cc=in`, { timeout: 6000 });
                const song = sRes.data?.[Object.keys(sRes.data)[0]];
                if (song && song.id) {
                    return [{
                        id: `saavn_${song.id}`,
                        uri: `spotify:track:saavn_${song.id}`,
                        name: decodeHtmlEntities(song.song || song.title),
                        artists: [{ name: decodeHtmlEntities(song.primary_artists || song.singers || 'Unknown Artist') }],
                        album: {
                            name: decodeHtmlEntities(song.album || song.song),
                            images: [{ url: (song.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(song.duration) || 180) * 1000,
                        preview_url: song.media_preview_url || null
                    }];
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] JioSaavn song URL parse failed:', err.message);
            }
        }

        // Clean query: strip "by" keyword (e.g. "eyes dont lie by isabel larose" -> "eyes dont lie isabel larose")
        const cleanQuery = cleanSearchQuery(raw);

        const results: Track[] = [];
        const seenKeys = new Set<string>();

        // 3. Parallel Search: JioSaavn + iTunes
        const [saavnRes, itunesRes] = await Promise.allSettled([
            axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'search.getResults',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    p: 1,
                    n: limit,
                    q: cleanQuery
                },
                timeout: 5000
            }),
            axios.get('https://itunes.apple.com/search', {
                params: {
                    term: cleanQuery,
                    entity: 'song',
                    limit
                },
                timeout: 5000
            })
        ]);

        // A. Process JioSaavn results first (highest relevance for original studio tracks)
        if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data?.results)) {
            for (const item of saavnRes.value.data.results) {
                const name = decodeHtmlEntities(item.song || item.title);
                const artist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
                const normKey = `${name.toLowerCase()} - ${artist.toLowerCase()}`;
                if (!seenKeys.has(normKey)) {
                    seenKeys.add(normKey);
                    results.push({
                        id: `saavn_${item.id}`,
                        uri: `spotify:track:saavn_${item.id}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: decodeHtmlEntities(item.album || name),
                            images: [{ url: (item.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(item.duration) || 180) * 1000,
                        preview_url: item.media_preview_url || null
                    });
                }
            }
        }

        // B. Merge distinct iTunes results for comprehensive library coverage
        if (itunesRes.status === 'fulfilled' && Array.isArray(itunesRes.value.data?.results)) {
            for (const item of itunesRes.value.data.results) {
                const name = item.trackName;
                const artist = item.artistName || 'Unknown Artist';
                const normKey = `${name.toLowerCase()} - ${artist.toLowerCase()}`;
                if (!seenKeys.has(normKey)) {
                    seenKeys.add(normKey);
                    results.push({
                        id: String(item.trackId),
                        uri: `spotify:track:${item.trackId}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: item.collectionName || item.trackName,
                            images: [{
                                url: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : ''
                            }]
                        },
                        duration_ms: item.trackTimeMillis || 180000,
                        preview_url: item.previewUrl || null
                    });
                }
            }
        }

        // C. Deezer fallback if both returned 0 results
        if (results.length === 0) {
            try {
                const deezerRes = await axios.get('https://api.deezer.com/search', {
                    params: { q: cleanQuery, limit },
                    timeout: 5000
                });
                if (deezerRes.data?.data?.length) {
                    return deezerRes.data.data.map((item: any) => ({
                        id: String(item.id),
                        uri: `spotify:track:${item.id}`,
                        name: item.title,
                        artists: [{ name: item.artist?.name || 'Unknown Artist' }],
                        album: {
                            name: item.album?.title || item.title,
                            images: [{ url: item.album?.cover_medium || item.album?.cover || '' }]
                        },
                        duration_ms: (item.duration || 180) * 1000,
                        preview_url: item.preview || null
                    }));
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] Deezer search fallback error:', err.message);
            }
        }

        return results.slice(0, limit);
    }

    /**
     * Get featured playlists
     */
    async getFeaturedPlaylists(): Promise<Playlist[]> {
        return POPULAR_SPOTIFY_PLAYLISTS.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            images: [{ url: p.image }],
            owner: { id: 'spotify', display_name: 'Spotify' },
            tracks: { total: 50 }
        }));
    }

    /**
     * Get new releases from iTunes / Deezer open chart
     */
    async getNewReleases(): Promise<any[]> {
        try {
            const itunesRes = await axios.get('https://itunes.apple.com/us/rss/topalbums/limit=25/json', {
                timeout: 5000
            });
            const entries = itunesRes.data?.feed?.entry;
            if (Array.isArray(entries) && entries.length > 0) {
                return entries.map((e: any) => ({
                    id: e.id?.attributes?.['im:id'] || String(Math.random()),
                    name: e['im:name']?.label || 'Album',
                    artists: [{ name: e['im:artist']?.label || 'Artist' }],
                    images: [{
                        url: (e['im:image']?.[e['im:image'].length - 1]?.label || '').replace(/\d+x\d+bb/, '600x600bb')
                    }],
                    release_date: e['im:releaseDate']?.label || new Date().toISOString().split('T')[0],
                    total_tracks: 10
                }));
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] iTunes new releases error:', err.message);
        }

        try {
            const res = await axios.get('https://api.deezer.com/chart/0/albums', {
                params: { limit: 20 },
                timeout: 5000
            });
            if (res.data?.data?.length) {
                return res.data.data.map((album: any) => ({
                    id: String(album.id),
                    name: album.title,
                    artists: [{ name: album.artist?.name || 'Unknown Artist' }],
                    images: [{ url: album.cover_medium || album.cover_big || album.cover }],
                    release_date: new Date().toISOString().split('T')[0],
                    total_tracks: album.nb_tracks || 10
                }));
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Deezer new releases fallback error:', err.message);
        }

        return [];
    }

    /**
     * Curated Top 50 Global Superstars across diverse genres (Pop, R&B, Hip-Hop, Rock, Indie, Country, Global)
     */
    private readonly CURATED_TOP_50_ARTISTS: Artist[] = [
        { id: 'artist-taylor-swift', name: 'Taylor Swift', images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }], genres: ['Pop', 'Country'], followers: { total: 110000000 } },
        { id: 'artist-the-weeknd', name: 'The Weeknd', images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }], genres: ['R&B', 'Pop'], followers: { total: 95000000 } },
        { id: 'artist-drake', name: 'Drake', images: [{ url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500' }], genres: ['Hip-Hop', 'Rap'], followers: { total: 85000000 } },
        { id: 'artist-billie-eilish', name: 'Billie Eilish', images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500' }], genres: ['Alt-Pop', 'Electropop'], followers: { total: 92000000 } },
        { id: 'artist-ed-sheeran', name: 'Ed Sheeran', images: [{ url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500' }], genres: ['Pop', 'Acoustic'], followers: { total: 115000000 } },
        { id: 'artist-ariana-grande', name: 'Ariana Grande', images: [{ url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500' }], genres: ['Pop', 'R&B'], followers: { total: 94000000 } },
        { id: 'artist-post-malone', name: 'Post Malone', images: [{ url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500' }], genres: ['Hip-Hop', 'Pop Rock'], followers: { total: 43000000 } },
        { id: 'artist-bruno-mars', name: 'Bruno Mars', images: [{ url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500' }], genres: ['Pop', 'Funk', 'Soul'], followers: { total: 58000000 } },
        { id: 'artist-dua-lipa', name: 'Dua Lipa', images: [{ url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500' }], genres: ['Dance Pop', 'Disco'], followers: { total: 47000000 } },
        { id: 'artist-eminem', name: 'Eminem', images: [{ url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500' }], genres: ['Hip-Hop', 'Rap'], followers: { total: 88000000 } },
        { id: 'artist-rihanna', name: 'Rihanna', images: [{ url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500' }], genres: ['R&B', 'Pop'], followers: { total: 60000000 } },
        { id: 'artist-kendrick-lamar', name: 'Kendrick Lamar', images: [{ url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500' }], genres: ['Hip-Hop', 'Conscious Rap'], followers: { total: 32000000 } },
        { id: 'artist-coldplay', name: 'Coldplay', images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500' }], genres: ['Alternative Rock', 'Pop Rock'], followers: { total: 53000000 } },
        { id: 'artist-lana-del-rey', name: 'Lana Del Rey', images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }], genres: ['Dream Pop', 'Baroque Pop'], followers: { total: 38000000 } },
        { id: 'artist-adele', name: 'Adele', images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500' }], genres: ['Soul', 'Pop'], followers: { total: 56000000 } },
        { id: 'artist-justin-bieber', name: 'Justin Bieber', images: [{ url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=500' }], genres: ['Pop', 'R&B'], followers: { total: 76000000 } },
        { id: 'artist-travis-scott', name: 'Travis Scott', images: [{ url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500' }], genres: ['Hip-Hop', 'Trap'], followers: { total: 35000000 } },
        { id: 'artist-beyonce', name: 'Beyoncé', images: [{ url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500' }], genres: ['R&B', 'Pop'], followers: { total: 37000000 } },
        { id: 'artist-harry-styles', name: 'Harry Styles', images: [{ url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500' }], genres: ['Pop Rock', 'Soft Rock'], followers: { total: 32000000 } },
        { id: 'artist-sza', name: 'SZA', images: [{ url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500' }], genres: ['Neo-Soul', 'R&B'], followers: { total: 24000000 } },
        { id: 'artist-olivia-rodrigo', name: 'Olivia Rodrigo', images: [{ url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500' }], genres: ['Pop Rock', 'Teen Pop'], followers: { total: 31000000 } },
        { id: 'artist-bad-bunny', name: 'Bad Bunny', images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }], genres: ['Reggaeton', 'Latin Trap'], followers: { total: 82000000 } },
        { id: 'artist-arctic-monkeys', name: 'Arctic Monkeys', images: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500' }], genres: ['Indie Rock', 'Garage Rock'], followers: { total: 26000000 } },
        { id: 'artist-imagine-dragons', name: 'Imagine Dragons', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' }], genres: ['Alternative Rock', 'Pop Rock'], followers: { total: 61000000 } },
        { id: 'artist-queen', name: 'Queen', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' }], genres: ['Classic Rock', 'Glam Rock'], followers: { total: 49000000 } },
        { id: 'artist-michael-jackson', name: 'Michael Jackson', images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500' }], genres: ['Pop', 'Soul', 'Disco'], followers: { total: 43000000 } },
        { id: 'artist-daft-punk', name: 'Daft Punk', images: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' }], genres: ['Electronic', 'House'], followers: { total: 19000000 } },
        { id: 'artist-arijit-singh', name: 'Arijit Singh', images: [{ url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=500' }], genres: ['Bollywood', 'Romantic'], followers: { total: 104000000 } },
        { id: 'artist-bts', name: 'BTS', images: [{ url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500' }], genres: ['K-Pop', 'Dance'], followers: { total: 74000000 } },
        { id: 'artist-blackpink', name: 'BLACKPINK', images: [{ url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500' }], genres: ['K-Pop', 'EDM'], followers: { total: 49000000 } },
        { id: 'artist-linkin-park', name: 'Linkin Park', images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500' }], genres: ['Nu-Metal', 'Alt-Rock'], followers: { total: 31000000 } },
        { id: 'artist-nirvana', name: 'Nirvana', images: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500' }], genres: ['Grunge', 'Rock'], followers: { total: 22000000 } },
        { id: 'artist-radiohead', name: 'Radiohead', images: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500' }], genres: ['Art Rock', 'Electronic'], followers: { total: 11000000 } },
        { id: 'artist-frank-ocean', name: 'Frank Ocean', images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }], genres: ['R&B', 'Neo-Soul'], followers: { total: 16000000 } },
        { id: 'artist-tyler-the-creator', name: 'Tyler, the Creator', images: [{ url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500' }], genres: ['Hip-Hop', 'Neo-Soul'], followers: { total: 18000000 } },
        { id: 'artist-j-cole', name: 'J. Cole', images: [{ url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500' }], genres: ['Hip-Hop', 'Rap'], followers: { total: 25000000 } },
        { id: 'artist-kanye-west', name: 'Kanye West', images: [{ url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500' }], genres: ['Hip-Hop', 'Art Pop'], followers: { total: 28000000 } },
        { id: 'artist-katy-perry', name: 'Katy Perry', images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }], genres: ['Pop', 'Disco'], followers: { total: 35000000 } },
        { id: 'artist-lady-gaga', name: 'Lady Gaga', images: [{ url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500' }], genres: ['Pop', 'Dance'], followers: { total: 30000000 } },
        { id: 'artist-miley-cyrus', name: 'Miley Cyrus', images: [{ url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500' }], genres: ['Pop Rock', 'Country'], followers: { total: 28000000 } },
        { id: 'artist-sia', name: 'Sia', images: [{ url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500' }], genres: ['Pop', 'Electropop'], followers: { total: 26000000 } },
        { id: 'artist-shawn-mendes', name: 'Shawn Mendes', images: [{ url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500' }], genres: ['Pop', 'Acoustic'], followers: { total: 44000000 } },
        { id: 'artist-sam-smith', name: 'Sam Smith', images: [{ url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500' }], genres: ['Soul', 'Pop'], followers: { total: 23000000 } },
        { id: 'artist-khalid', name: 'Khalid', images: [{ url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500' }], genres: ['R&B', 'Pop'], followers: { total: 17000000 } },
        { id: 'artist-the-neighbourhood', name: 'The Neighbourhood', images: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500' }], genres: ['Indie Rock', 'Dark Pop'], followers: { total: 15000000 } },
        { id: 'artist-lorde', name: 'Lorde', images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500' }], genres: ['Art Pop', 'Indie'], followers: { total: 14000000 } },
        { id: 'artist-hozier', name: 'Hozier', images: [{ url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=500' }], genres: ['Indie Rock', 'Soul'], followers: { total: 16000000 } },
        { id: 'artist-zach-bryan', name: 'Zach Bryan', images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }], genres: ['Country', 'Folk Rock'], followers: { total: 18200000 } },
        { id: 'artist-hollow-coves', name: 'Hollow Coves', images: [{ url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=500' }], genres: ['Indie Folk', 'Acoustic'], followers: { total: 4200000 } },
        { id: 'artist-tom-odell', name: 'Tom Odell', images: [{ url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500' }], genres: ['Singer-Songwriter', 'Piano Rock'], followers: { total: 8900000 } }
    ];

    /**
     * Get top artists (returns 50 top artists by combining live charts with curated global superstars)
     */
    async getTopArtists(limit: number = 50): Promise<Artist[]> {
        const results: Artist[] = [];
        const seenNames = new Set<string>();

        try {
            // Fetch live trending chart artists from Deezer
            const res = await axios.get('https://api.deezer.com/chart/0/artists', {
                params: { limit: Math.min(limit, 50) },
                timeout: 5000
            });
            if (res.data?.data?.length) {
                for (const a of res.data.data) {
                    const cleanName = (a.name || '').trim();
                    const norm = cleanName.toLowerCase();
                    if (cleanName && !seenNames.has(norm)) {
                        seenNames.add(norm);
                        results.push({
                            id: `dz_${a.id}`,
                            name: cleanName,
                            images: [{ url: a.picture_big || a.picture_medium || a.picture || '' }],
                            genres: ['Top Chart', 'Pop'],
                            followers: { total: a.nb_fan || 1200000 }
                        });
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Deezer live top artists notice:', err.message);
        }

        // Merge with iconic curated top 50 to guarantee exactly 50+ diverse global superstars
        for (const curated of this.CURATED_TOP_50_ARTISTS) {
            const norm = curated.name.toLowerCase();
            if (!seenNames.has(norm)) {
                seenNames.add(norm);
                results.push(curated);
            }
            if (results.length >= limit) break;
        }

        return results.slice(0, limit);
    }

    /**
     * Real-time Artist Search:
     * Searches across Deezer (100M+ catalog) and iTunes in real time.
     */
    async searchArtists(query: string, limit: number = 25): Promise<Artist[]> {
        const clean = (query || '').trim();
        if (!clean) return this.getTopArtists(limit);

        const results: Artist[] = [];
        const seen = new Set<string>();

        // 1. First check matching artists from our curated collection
        for (const curated of this.CURATED_TOP_50_ARTISTS) {
            if (curated.name.toLowerCase().includes(clean.toLowerCase())) {
                results.push(curated);
                seen.add(curated.name.toLowerCase());
            }
        }

        // 2. Query Deezer's live worldwide artist search
        try {
            const deezerRes = await axios.get('https://api.deezer.com/search/artist', {
                params: { q: clean, limit },
                timeout: 5000
            });
            if (deezerRes.data?.data?.length) {
                for (const item of deezerRes.data.data) {
                    const norm = (item.name || '').toLowerCase();
                    if (!seen.has(norm)) {
                        seen.add(norm);
                        results.push({
                            id: `dz_${item.id}`,
                            name: item.name,
                            images: [{ url: item.picture_big || item.picture_medium || item.picture || '' }],
                            genres: ['Global Music', 'Artist'],
                            followers: { total: item.nb_fan || 500000 }
                        });
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Deezer artist search notice:', err.message);
        }

        // 3. Fallback to iTunes Artist Search if Deezer returned few results
        if (results.length < 5) {
            try {
                const itunesRes = await axios.get('https://itunes.apple.com/search', {
                    params: { term: clean, entity: 'musicArtist', limit },
                    timeout: 5000
                });
                if (itunesRes.data?.results?.length) {
                    for (const item of itunesRes.data.results) {
                        const norm = (item.artistName || '').toLowerCase();
                        if (!seen.has(norm)) {
                            seen.add(norm);
                            results.push({
                                id: `it_${item.artistId}`,
                                name: item.artistName,
                                images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' }],
                                genres: item.primaryGenreName ? [item.primaryGenreName] : ['Artist'],
                                followers: { total: 1000000 }
                            });
                        }
                    }
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] iTunes artist search notice:', err.message);
            }
        }

        return results.slice(0, limit);
    }

    /**
     * Get Artist Top Tracks:
     * Discovers an artist's top playable songs across open metadata
     */
    async getArtistTracks(artistId: string, artistName?: string): Promise<Track[]> {
        const query = (artistName || artistId || '').replace(/^(dz_|it_|artist-)/, '').replace(/-/g, ' ');
        return this.searchTracks(query, 25);
    }

    /**
     * Get top tracks
     */
    async getTopTracks(): Promise<Track[]> {
        try {
            const itunesRes = await axios.get('https://itunes.apple.com/us/rss/topsongs/limit=30/json', {
                timeout: 5000
            });
            const entries = itunesRes.data?.feed?.entry;
            if (Array.isArray(entries) && entries.length > 0) {
                return entries.map((e: any) => {
                    const id = e.id?.attributes?.['im:id'] || String(Math.random());
                    const previewLink = Array.isArray(e.link)
                        ? e.link.find((l: any) => l.attributes?.type?.includes('audio'))?.attributes?.href
                        : null;
                    const rawImg = e['im:image']?.[e['im:image'].length - 1]?.label || '';
                    const hdImg = rawImg.replace(/\d+x\d+bb/, '600x600bb');

                    return {
                        id,
                        uri: `spotify:track:${id}`,
                        name: e['im:name']?.label || 'Top Track',
                        artists: [{ name: e['im:artist']?.label || 'Unknown Artist' }],
                        album: {
                            name: e['im:collection']?.['im:name']?.label || e['im:name']?.label || 'Single',
                            images: [{ url: hdImg }]
                        },
                        duration_ms: 210000,
                        preview_url: previewLink || null
                    };
                });
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] iTunes top tracks error:', err.message);
        }

        try {
            const res = await axios.get('https://api.deezer.com/chart/0/tracks', {
                params: { limit: 20 },
                timeout: 5000
            });
            if (res.data?.data?.length) {
                return res.data.data.map((item: any) => ({
                    id: String(item.id),
                    uri: `spotify:track:${item.id}`,
                    name: item.title,
                    artists: [{ name: item.artist?.name || 'Unknown Artist' }],
                    album: {
                        name: item.album?.title || item.title,
                        images: [{ url: item.album?.cover_medium || item.album?.cover_big || '' }]
                    },
                    duration_ms: (item.duration || 180) * 1000,
                    preview_url: item.preview || null
                }));
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Top tracks error:', err.message);
        }

        return [];
    }

    /**
     * Browse categories
     */
    async getCategories(): Promise<Category[]> {
        return [
            { id: 'pop', name: 'Pop', icons: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' }] },
            { id: 'hip-hop', name: 'Hip-Hop', icons: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300' }] },
            { id: 'rock', name: 'Rock', icons: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300' }] },
            { id: 'chill', name: 'Chill', icons: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300' }] },
            { id: 'dance-electronic', name: 'Electronic', icons: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' }] },
            { id: 'workout', name: 'Workout', icons: [{ url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300' }] },
            { id: 'focus', name: 'Focus', icons: [{ url: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=300' }] },
            { id: 'country', name: 'Country', icons: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300' }] }
        ];
    }

    /**
     * Category playlists
     */
    async getCategoryPlaylists(categoryId: string): Promise<Playlist[]> {
        const featured = await this.getFeaturedPlaylists();
        return featured;
    }

    /**
     * Recommendations based on seed tracks
     */
    async getRecommendations(seedTracks: string[]): Promise<Track[]> {
        return this.getTopTracks();
    }

    /**
     * Smart Mood Suggestions:
     * Discovers songs matching the mood, style, and sonic cluster of the current track & artist.
     */
    async getSmartMoodSuggestions(trackName: string, artistName: string): Promise<Track[]> {
        const cleanTrack = (trackName || '').toLowerCase().trim();
        const cleanArtist = (artistName || '').trim();
        const suggestions: Track[] = [];
        const seenIds = new Set<string>();

        try {
            if (cleanArtist) {
                const artistRes = await axios.get('https://api.deezer.com/search/artist', {
                    params: { q: cleanArtist, limit: 1 },
                    timeout: 4000
                });

                const artistObj = artistRes.data?.data?.[0];
                if (artistObj?.id) {
                    const [topRes, relatedRes] = await Promise.allSettled([
                        axios.get(`https://api.deezer.com/artist/${artistObj.id}/top?limit=8`, { timeout: 4000 }),
                        axios.get(`https://api.deezer.com/artist/${artistObj.id}/related?limit=5`, { timeout: 4000 })
                    ]);

                    if (topRes.status === 'fulfilled' && topRes.value.data?.data) {
                        for (const item of topRes.value.data.data) {
                            if (item.title?.toLowerCase() !== cleanTrack && !seenIds.has(String(item.id))) {
                                seenIds.add(String(item.id));
                                suggestions.push({
                                    id: String(item.id),
                                    uri: `spotify:track:${item.id}`,
                                    name: item.title,
                                    artists: [{ name: item.artist?.name || cleanArtist }],
                                    album: {
                                        name: item.album?.title || item.title,
                                        images: [{ url: item.album?.cover_medium || item.album?.cover || '' }]
                                    },
                                    duration_ms: (item.duration || 180) * 1000,
                                    preview_url: item.preview || null
                                });
                            }
                        }
                    }

                    if (relatedRes.status === 'fulfilled' && relatedRes.value.data?.data) {
                        for (const relArtist of relatedRes.value.data.data.slice(0, 3)) {
                            try {
                                const relTracks = await axios.get(`https://api.deezer.com/artist/${relArtist.id}/top?limit=3`, { timeout: 3000 });
                                if (relTracks.data?.data) {
                                    for (const item of relTracks.data.data) {
                                        if (!seenIds.has(String(item.id))) {
                                            seenIds.add(String(item.id));
                                            suggestions.push({
                                                id: String(item.id),
                                                uri: `spotify:track:${item.id}`,
                                                name: item.title,
                                                artists: [{ name: item.artist?.name || relArtist.name }],
                                                album: {
                                                    name: item.album?.title || item.title,
                                                    images: [{ url: item.album?.cover_medium || item.album?.cover || '' }]
                                                },
                                                duration_ms: (item.duration || 180) * 1000,
                                                preview_url: item.preview || null
                                            });
                                        }
                                    }
                                }
                            } catch (e) { }
                        }
                    }
                }
            }

            if (suggestions.length < 5 && cleanArtist) {
                const itunes = await this.searchTracks(cleanArtist, 10);
                for (const t of itunes) {
                    if (t.name.toLowerCase() !== cleanTrack && !seenIds.has(t.id)) {
                        seenIds.add(t.id);
                        suggestions.push(t);
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Smart mood suggestions error:', err.message);
        }

        if (suggestions.length === 0) {
            return this.getTopTracks();
        }

        return suggestions;
    }
}
