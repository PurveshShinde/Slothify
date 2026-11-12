import type { Track } from '../../../interfaces.js';
import { getSpotubeSpotifyToken } from '../auth/spotubeAuth.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function searchSpotubeSpotifyTracks(cleanQuery: string, limit: number = 20): Promise<Track[]> {
    const token = await getSpotubeSpotifyToken();
    if (!token) return [];

    try {
        const gqlVariables = {
            searchTerm: cleanQuery,
            offset: 0,
            limit: Math.min(limit, 30),
            numberOfTopResults: 5,
            includeAudiobooks: false,
            includePreReleases: true
        };
        const gqlExtensions = {
            persistedQuery: {
                version: 1,
                sha256Hash: '75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec'
            }
        };

        const gqlUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(JSON.stringify(gqlVariables))}&extensions=${encodeURIComponent(JSON.stringify(gqlExtensions))}`;

        const gqlRes = await fetch(gqlUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!gqlRes.ok) return [];

        const gqlData = await gqlRes.json() as any;
        const items = gqlData.data?.search?.tracks?.items || gqlData.data?.searchV2?.tracksV2?.items || [];
        const tracks: Track[] = [];

        for (const wrapper of items) {
            const t = wrapper.track || wrapper.item?.data || wrapper;
            if (!t || !t.id) continue;

            const coverArt = t.album?.coverArt?.sources || t.albumOfTrack?.coverArt?.sources || t.album?.images || [];
            const rawArt = coverArt[coverArt.length - 1]?.url || coverArt[0]?.url || '';
            const art = rawArt ? rawArt.replace(/00001e02|00004851/, '0000b273') : '';

            const artistsList = (t.artists?.items || t.artists || []).map((a: any) => ({
                name: typeof a === 'string' ? a : a.profile?.name || a.name || 'Unknown Artist'
            }));

            tracks.push({
                id: t.id,
                uri: t.uri || `spotify:track:${t.id}`,
                name: t.name,
                artists: artistsList.length > 0 ? artistsList : [{ name: 'Unknown Artist' }],
                album: {
                    name: t.album?.name || t.albumOfTrack?.name || t.name,
                    images: art ? [{ url: art }] : []
                },
                duration_ms: t.duration?.totalMilliseconds || 180000,
                preview_url: null
            });
        }
        return tracks;
    } catch (e: any) {
        console.warn('[SpotifyScraperPlugin] Spotube GQL search error:', e.message);
        return [];
    }
}

/**
 * Direct Spotify dedicated Artist Search using Spotify Web Player GraphQL (Pathfinder)
 */
export async function searchSpotifyArtists(cleanQuery: string, limit: number = 20): Promise<{ id: string; name: string; picture: string }[]> {
    const token = await getSpotubeSpotifyToken();
    if (!token) return [];

    try {
        const variables = {
            searchTerm: cleanQuery,
            offset: 0,
            limit: Math.min(limit, 30),
            numberOfTopResults: 5,
            includeAudiobooks: false,
            includePreReleases: true
        };
        const extensions = {
            persistedQuery: {
                version: 1,
                sha256Hash: '75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec'
            }
        };

        const gqlUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;

        const gqlRes = await fetch(gqlUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': USER_AGENT
            },
            signal: AbortSignal.timeout(8000)
        });

        if (!gqlRes.ok) return [];

        const gqlData = await gqlRes.json() as any;
        const items = gqlData.data?.search?.artists?.items || [];
        const artists: { id: string; name: string; picture: string }[] = [];

        for (const item of items) {
            const uri = item.uri || '';
            const id = uri.replace('spotify:artist:', '');
            const name = item.profile?.name || '';
            if (!id || !name) continue;
            const sources = item.visuals?.avatarImage?.sources || item.visuals?.headerImage?.sources || [];
            let picture = sources.find((s: any) => s.width >= 500)?.url || sources[0]?.url || '';
            if (picture) {
                picture = picture.replace(/00001e02|00004851/, '0000b273');
            }
            artists.push({ id, name, picture });
        }
        return artists;
    } catch (e: any) {
        console.warn('[SpotifyScraperPlugin] searchSpotifyArtists error:', e.message);
        return [];
    }
}

export interface SpotifyArtistOverviewData {
    id: string;
    name: string;
    followers: number;
    monthlyListeners: number;
    avatarUrl: string;
    headerUrl: string;
    verified: boolean;
    topTracks?: Track[];
}

const ARTIST_OVERVIEW_CACHE = new Map<string, SpotifyArtistOverviewData>();
const PENDING_OVERVIEWS = new Map<string, Promise<any>>();

/**
 * Fetch official Spotify Artist Overview (authentic follower counts, monthly listeners, and ultra-res portraits)
 */
export async function fetchSpotifyArtistOverview(artistId: string): Promise<SpotifyArtistOverviewData | null> {
    if (!artistId) return null;
    if (ARTIST_OVERVIEW_CACHE.has(artistId)) {
        return ARTIST_OVERVIEW_CACHE.get(artistId)!;
    }
    if (PENDING_OVERVIEWS.has(artistId)) {
        return PENDING_OVERVIEWS.get(artistId)!;
    }

    const promise = (async () => {
        const token = await getSpotubeSpotifyToken();
        if (!token) return null;

        try {
            const variables = {
                uri: `spotify:artist:${artistId}`,
                locale: '',
                includePrerelease: true
            };
            const extensions = {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '79a4a9d7c3a3781d801e62b62ef11c7ee56fce2626772eb26cd20c69f84b3f49'
                }
            };

            const gqlUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=queryArtistOverview&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;

            const gqlRes = await fetch(gqlUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'User-Agent': USER_AGENT
                },
                signal: AbortSignal.timeout(8000)
            });

            if (!gqlRes.ok) return null;

            const gqlData = await gqlRes.json() as any;
            const union = gqlData.data?.artistUnion;
            if (!union) return null;

            const sources = union.visuals?.avatarImage?.sources || [];
            const avatarUrl = sources.find((s: any) => s.width >= 500)?.url || sources[0]?.url || '';
            const headerSources = union.visuals?.headerImage?.sources || [];
            const headerUrl = headerSources[0]?.url || '';

            const topTracks: Track[] = (union.discography?.topTracks?.items || []).map((i: any) => {
                const tr = i.track;
                if (!tr) return null;
                const coverSources = tr.albumOfTrack?.coverArt?.sources || [];
                // Upgrade to crystal clear 640x640 (b273)
                const cover = coverSources.find((s: any) => s.url?.includes('b273'))?.url
                    || coverSources[0]?.url?.replace('ab67616d00001e02', 'ab67616d0000b273')
                    || coverSources[0]?.url || '';
                return {
                    id: tr.id || tr.uri?.replace('spotify:track:', '') || '',
                    uri: tr.uri || `spotify:track:${tr.id}`,
                    name: tr.name || 'Unknown Track',
                    artists: (tr.artists?.items || []).map((a: any) => ({ name: a.profile?.name || '' })).filter((a: any) => a.name),
                    album: {
                        name: tr.albumOfTrack?.name || tr.name,
                        images: cover ? [{ url: cover }] : []
                    },
                    duration_ms: tr.duration?.totalMilliseconds || 180000,
                    preview_url: null
                };
            }).filter(Boolean) as Track[];

            const result = {
                id: union.id || artistId,
                name: union.profile?.name || '',
                followers: typeof union.stats?.followers === 'number' ? union.stats.followers : 0,
                monthlyListeners: typeof union.stats?.monthlyListeners === 'number' ? union.stats.monthlyListeners : 0,
                avatarUrl,
                headerUrl,
                verified: !!union.profile?.verified,
                topTracks
            };

            ARTIST_OVERVIEW_CACHE.set(artistId, result);
            return result;
        } catch (e: any) {
            console.warn('[SpotifyScraperPlugin] fetchSpotifyArtistOverview error:', e.message);
            return null;
        } finally {
            PENDING_OVERVIEWS.delete(artistId);
        }
    })();

    PENDING_OVERVIEWS.set(artistId, promise);
    return promise;
}

