import type { Track } from '../../../interfaces.js';
import { TOP_ARTIST_PROFILES } from '../catalogs/topArtistsCatalog.js';
import { isArtistNameMatch } from '../utils/similarityUtils.js';
import { searchSpotifyArtists, fetchSpotifyArtistOverview } from '../clients/spotifyGqlClient.js';

export const TOP_ARTIST_SPOTIFY_IDS: Record<string, string> = {
    'taylor swift': '06HL4z0CvFAxyc27GXpf02',
    'the weeknd': '1Xyo4u8uXC1ZmMpatF05PJ',
    'drake': '3TVXtAsR1Inumwj472S9r4',
    'billie eilish': '6qqNVTkY8uBg9cP3Jd7DAH',
    'ariana grande': '66CXWjxzNUsdJxJ2JdwvnR',
    'bruno mars': '0du5cEVh5yTK9QJze8zA0C',
    'dua lipa': '6M2wZ9GZgrQXHCF2UCsqJu',
    'olivia rodrigo': '1McMsnEElThX1knmY4oliG',
    'kendrick lamar': '2YZyLoL8N0Wb9xBt1NhZWg',
    'justin bieber': '1uNFoZAHBGtllmzznpCI3s',
    'ed sheeran': '6eUKZXaKkcviH0Ku9w2n3V',
    'travis scott': '0Y5tJX1MQlPlqiwlOH1tJY',
    'sza': '7tYKF4w9nC0nq9CsPZTHte',
    'sabrina carpenter': '74KM79TiuVKeVCqs8QtB0B',
    'tame impala': '5INjqkS1o8h1imAzPqGZBb',
    'morgan wallen': '4oUHIQIBe0LHzYfvXNW4QM',
    'zach bryan': '40ZNYROS4zLfyyBSs2PGe2',
    'beyoncé': '6vWDO969PvNqNYHIOW5v0m',
    'lady gaga': '1HY2Jd0NmPuamShAr6KMms',
    'adele': '4dpARuHxo51G3z768sgnrY',
    'imagine dragons': '53XhwfbYqKCa1cC15pYq2q',
    'maroon 5': '04gDigrS5kc9YWfZHwBETP',
    'selena gomez': '0C8ZW7ezQVs4URX5aX7Kqx',
    'khalid': '6LuN9FCkKOj5PcnpouEgny',
    'chappell roan': '7GlBOeep6PqTfFi59PTJUt',
    'tate mcrae': '45dkTj5sMRSjrmBSBeiHym',
    'karol g': '790FomKkXshlbRYZFtlgla',
    'ashe': '6P5NO5hzJbuOqSdyPB7SJM',
    'adéla': '2qanRMyA5bNuTvz1dK45OP',
    'adela': '2qanRMyA5bNuTvz1dK45OP',
    'malcolm todd': '7eKkW1zo5uzW8kUntiiBvz',
    'judeline': '1H6X7yhnXZg73f9bssaj1Q',
    'rusowsky': '1XEVu7gdRFfzEFqsPrancH',
    'post malone': '246dkjvS1zLTtiykXe5h60',
    'eminem': '7dGJoVhflACIMRgwmHGw7F',
    'bad bunny': '4q3ewBCX7sLwd24euqV69X',
    'lana del rey': '00FQb4jTyendYWaN8pK0wa',
    'coldplay': '4gzpq5Yv4ugG4snTC7egGg',
    'rihanna': '5pKCCKE222Gq7TrgTROiCo',
    'harry styles': '6KImCVD70vtRI0nl9ydGBr',
    'doja cat': '5cj0nqj0qpeqvuj2tm1zb7',
    'future': '1RyvyyTE3KVwmbtSYdZVvK',
    'metro boomin': '0iEtIxbK0KxaSlF7G52ZYY',
    '21 savage': '1URnnhqYAYcrqrcwql10ft',
    'shawn mendes': '7n2wHs1T7yVHUIxOXAn21Q',
    'camila cabello': '4nDoRrQiYLoBzwCjiDJv1n',
    'charlie puth': '665qv5gTsgI2s8t79xZq1N'
};

export interface ArtistMeta {
    imageUrl: string;
    headerUrl?: string;
    followers: number;
    monthlyListeners?: number;
    genres: string[];
    bio?: string;
    verified?: boolean;
    topTracks?: Track[];
}

export const ARTIST_META_CACHE = new Map<string, ArtistMeta>();

export function getArtistFollowers(artistName: string): number {
    if (!artistName) return 0;
    const norm = artistName.toLowerCase().trim();
    if (typeof ARTIST_META_CACHE !== 'undefined' && ARTIST_META_CACHE.has(norm)) {
        return ARTIST_META_CACHE.get(norm)!.followers || 0;
    }
    const clean = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (typeof ARTIST_META_CACHE !== 'undefined' && ARTIST_META_CACHE.has(clean)) {
        return ARTIST_META_CACHE.get(clean)!.followers || 0;
    }
    if (typeof TOP_ARTIST_PROFILES !== 'undefined' && (TOP_ARTIST_PROFILES[norm] || TOP_ARTIST_PROFILES[clean])) {
        return 10000000;
    }
    return 0;
}

/**
 * Dynamically resolves official Spotify artist ID for any artist worldwide
 */
export async function resolveSpotifyArtistId(artistName: string): Promise<string | null> {
    const norm = artistName.toLowerCase().trim();
    if (TOP_ARTIST_SPOTIFY_IDS[norm]) return TOP_ARTIST_SPOTIFY_IDS[norm];

    try {
        const spArtists = await searchSpotifyArtists(artistName, 5);
        const match = spArtists.find(a => isArtistNameMatch(a.name, artistName)) || spArtists[0];
        if (match?.id) {
            TOP_ARTIST_SPOTIFY_IDS[norm] = match.id;
            return match.id;
        }
    } catch {}

    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=site:open.spotify.com/artist/+${encodeURIComponent(artistName)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
            const html = await res.text();
            const m = html.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]{22})/);
            if (m && m[1]) {
                TOP_ARTIST_SPOTIFY_IDS[norm] = m[1];
                return m[1];
            }
        }
    } catch { }
    return null;
}

/**
 * Query YouTube Innertube for high-resolution artist channel avatar and official metadata
 */
export async function resolveYouTubeArtistAvatar(artistName: string): Promise<string> {
    try {
        const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
                query: `${artistName} official`
            }),
            signal: AbortSignal.timeout(3500)
        });
        if (response.ok) {
            const data = await response.json() as any;
            const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            for (const section of contents || []) {
                for (const item of section.itemSectionRenderer?.contents || []) {
                    if (item.channelRenderer?.thumbnail?.thumbnails?.length) {
                        const thumbs = item.channelRenderer.thumbnail.thumbnails;
                        const url = thumbs[thumbs.length - 1].url;
                        return url.replace(/=s\d+[^"]*/, '=s500-c-k-c0x00ffffff-no-rj').replace(/^\/\//, 'https://');
                    }
                    if (item.videoRenderer?.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.length) {
                        const thumbs = item.videoRenderer.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail.thumbnails;
                        const url = thumbs[thumbs.length - 1].url;
                        return url.replace(/=s\d+[^"]*/, '=s500-c-k-c0x00ffffff-no-rj').replace(/^\/\//, 'https://');
                    }
                }
            }
        }
    } catch (e) {}
    return '';
}

export async function resolveArtistMetadata(artistName: string): Promise<ArtistMeta> {
    const norm = artistName.toLowerCase().trim();
    if (ARTIST_META_CACHE.has(norm)) {
        return ARTIST_META_CACHE.get(norm)!;
    }

    const normalizedClean = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let imageUrl = TOP_ARTIST_PROFILES[norm] || TOP_ARTIST_PROFILES[normalizedClean] || '';
    let headerUrl = '';
    let followers = 0;
    let monthlyListeners = 0;
    let bio: string | undefined = undefined;
    let verified = false;
    let genres = ['Pop', 'Top Hits'];
    let topTracks: Track[] = [];

    // 1. Resolve official Spotify Artist ID if not known
    let spotifyId = TOP_ARTIST_SPOTIFY_IDS[norm] || TOP_ARTIST_SPOTIFY_IDS[normalizedClean];
    if (!spotifyId) {
        try {
            const spMatches = await searchSpotifyArtists(artistName, 5);
            const matched = spMatches.find(m => isArtistNameMatch(m.name, artistName)) || spMatches[0];
            if (matched) {
                spotifyId = matched.id;
                TOP_ARTIST_SPOTIFY_IDS[norm] = spotifyId;
                if (!imageUrl && matched.picture) {
                    imageUrl = matched.picture;
                }
            }
        } catch {}
    }

    // 2. Query Spotify GraphQL Pathfinder for authentic followers, monthly listeners, and ultra-res portraits
    if (spotifyId) {
        try {
            const overview = await fetchSpotifyArtistOverview(spotifyId);
            if (overview) {
                if (overview.followers && overview.followers > 0) {
                    followers = overview.followers;
                }
                if (overview.monthlyListeners && overview.monthlyListeners > 0) {
                    monthlyListeners = overview.monthlyListeners;
                }
                if (overview.avatarUrl) {
                    imageUrl = overview.avatarUrl;
                }
                if (overview.headerUrl) {
                    headerUrl = overview.headerUrl;
                }
                verified = overview.verified;
                if (overview.topTracks && overview.topTracks.length > 0) {
                    topTracks = overview.topTracks;
                }
            }
        } catch (e) {}
    }

    if (!imageUrl) {
        try {
            const ytAvatar = await resolveYouTubeArtistAvatar(artistName);
            if (ytAvatar) imageUrl = ytAvatar;
        } catch {}
    }

    if (!imageUrl) {
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=181824&color=f5d0b5&size=500&bold=true`;
    }

    const meta: ArtistMeta = { imageUrl, headerUrl: headerUrl || imageUrl, followers, monthlyListeners, genres, bio, verified, topTracks };
    if (!imageUrl.includes('ui-avatars.com')) {
        ARTIST_META_CACHE.set(norm, meta);
    }
    return meta;
}

export function isJunkChannel(name: string, query: string): boolean {
    const lowerName = name.toLowerCase().trim();
    const lowerQ = query.toLowerCase().trim();
    if (lowerName === lowerQ) return false;

    // Reject composite artist names like "Dove Cameron, Khalid" when searching for an individual artist
    if ((lowerName.includes(',') || lowerName.includes('&') || /\b(feat\.?|ft\.?|with)\b/i.test(lowerName)) &&
        !lowerQ.includes(',') && !lowerQ.includes('&') && !/\b(feat\.?|ft\.?|with)\b/i.test(lowerQ)) {
        return true;
    }

    // Reject common corporate / commercial / junk channels
    const junkPatterns = [
        /\b(record|records|label|entertainment|music official|topic|production|games|series|unplugged|official audio|remix)\b/i,
        /\b(vevo|tv|corp|corporation|store|shop|commercial|hair|beauty|care)\b/i,
        /\b(us|uk|india|brazil|deutschland|france|latam|indonesia|philippines)\b/i
    ];
    for (const pat of junkPatterns) {
        if (pat.test(lowerName) && !pat.test(lowerQ)) {
            return true;
        }
    }
    return false;
}

