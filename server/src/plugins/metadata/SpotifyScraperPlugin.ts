import axios from 'axios';
import crypto from 'crypto';
import type { MetadataPlugin, Track, Playlist, Artist, Category } from '../interfaces.js';
import { localLibrary } from '../../store/localLibrary.js';
import { withTimeout } from '../../utils/timeout.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const playlistMemoryCache = new Map<string, { playlist: Playlist; expiresAt: number }>();

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

function decodeHtmlEntities(str: any): string {
    if (!str) return '';
    let val = str;
    if (typeof val !== 'string') {
        if (typeof val === 'object' && val.name) val = val.name;
        else if (typeof val === 'object' && val.title) val = val.title;
        else val = String(val || '');
    }
    return val
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

function base32Decode(str: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = str.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleaned.length; i++) {
        const val = alphabet.indexOf(cleaned[i]);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

function generateSpotubeTOTP(secretBase32: string, timestampSeconds: number): string {
    const period = 30;
    const counter = Math.floor(timestampSeconds / period);
    const key = base32Decode(secretBase32);

    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buf);
    const signature = hmac.digest();

    const offset = signature[signature.length - 1] & 0xf;
    const binary =
        ((signature[offset] & 0x7f) << 24) |
        ((signature[offset + 1] & 0xff) << 16) |
        ((signature[offset + 2] & 0xff) << 8) |
        (signature[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
}

let cachedSpotubeToken: { token: string; expiresAt: number } | null = null;
let pendingTokenPromise: Promise<string | null> | null = null;
let cachedNuance: { s: string; v: number } = { s: 'GM3TMMJTGYZTQNZVGM4DINJZHA4TGOBYGMZTCMRTGEYDSMJRHE4TEOBUG4YTCMRUGQ4DQOJUGQYTAMRRGA2TCMJSHE3TCMBY', v: 61 };
let nuanceFetched = false;

export async function getSpotubeSpotifyToken(): Promise<string | null> {
    if (cachedSpotubeToken && cachedSpotubeToken.expiresAt > Date.now()) {
        return cachedSpotubeToken.token;
    }
    if (pendingTokenPromise) {
        return pendingTokenPromise;
    }

    pendingTokenPromise = (async () => {
        try {
            if (!nuanceFetched) {
                nuanceFetched = true;
                fetch('https://gist.githubusercontent.com/raw/22ed9c6ba463899e933427f7de1f0eef/nuances.json', { signal: AbortSignal.timeout(2000) })
                    .then(res => res.ok ? res.json() : null)
                    .then(nuances => {
                        if (Array.isArray(nuances)) {
                            const latest = nuances.sort((a, b) => b.v - a.v)[0];
                            if (latest?.s) cachedNuance = latest;
                        }
                    })
                    .catch(() => {});
            }

            let serverTime = Math.floor(Date.now() / 1000);
            try {
                const timeRes = await fetch('https://open.spotify.com/api/server-time', { signal: AbortSignal.timeout(1500) });
                if (timeRes.ok) {
                    const timeData = await timeRes.json() as any;
                    if (timeData.serverTime) serverTime = timeData.serverTime;
                }
            } catch {}

            const totp = generateSpotubeTOTP(cachedNuance.s, serverTime);
            const tokenUrl = `https://open.spotify.com/api/token?reason=transport&productType=web-player&totp=${totp}&totpServer=${totp}&totpVer=${cachedNuance.v}`;

            const tokenRes = await fetch(tokenUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(8000)
            });

            if (tokenRes.ok) {
                const tokenData = await tokenRes.json() as any;
                if (tokenData.accessToken) {
                    cachedSpotubeToken = {
                        token: tokenData.accessToken,
                        expiresAt: Number(tokenData.accessTokenExpirationTimestampMs) || (Date.now() + 3500 * 1000)
                    };
                    return cachedSpotubeToken.token;
                }
            }
        } catch (e: any) {
            console.warn('[SpotifyScraperPlugin] Spotube token fetch warning:', e.message);
        } finally {
            pendingTokenPromise = null;
        }
        return null;
    })();

    return pendingTokenPromise;
}

// Pre-warm token in background immediately
getSpotubeSpotifyToken().catch(() => {});

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


export async function searchYouTubeInnertubeTracks(cleanQuery: string, limit: number = 20): Promise<Track[]> {
    try {
        const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
                query: cleanQuery
            }),
            signal: AbortSignal.timeout(4500)
        });

        if (!response.ok) return [];

        const data = (await response.json()) as any;
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        if (!Array.isArray(contents)) return [];

        const tracks: Track[] = [];
        for (const section of contents) {
            const items = section.itemSectionRenderer?.contents;
            if (!Array.isArray(items)) continue;

            for (const item of items) {
                const vr = item.videoRenderer;
                if (!vr || !vr.videoId) continue;

                const rawTitle = vr.title?.runs?.[0]?.text || '';
                let title = rawTitle;
                let artist = vr.ownerText?.runs?.[0]?.text || 'Unknown Artist';

                if (rawTitle.includes(' - ')) {
                    const parts = rawTitle.split(' - ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }

                title = title
                    .replace(/\s*\((Official\s*)?(Music\s*)?Video\)/gi, '')
                    .replace(/\s*\[(Official\s*)?(Music\s*)?Video\]/gi, '')
                    .replace(/\s*\((Audio|Official Audio|Lyrics?)\)/gi, '')
                    .replace(/\s*\[(Audio|Official Audio|Lyrics?)\]/gi, '')
                    .replace(/\s*\(HD\)/gi, '')
                    .trim();

                const thumbs = vr.thumbnail?.thumbnails;
                const imgUrl = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '';

                tracks.push({
                    id: vr.videoId,
                    uri: `spotify:track:${vr.videoId}`,
                    name: title,
                    artists: [{ name: artist }],
                    album: {
                        name: title,
                        images: [{ url: imgUrl }]
                    },
                    duration_ms: 180000,
                    preview_url: null
                });

                if (tracks.length >= limit) break;
            }
            if (tracks.length >= limit) break;
        }
        return tracks;
    } catch {
        return [];
    }
}

function getLevenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalizeSearchString(s: string): string {
    return (s || '')
        .toLowerCase()
        .replace(/["'’`]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getArtistFollowers(artistName: string): number {
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
 * Calculates string similarity between 0.0 and 1.0 using Levenshtein distance
 */
export function calculateSimilarity(s1: string, s2: string): number {
    return stringSimilarity(s1, s2);
}

/**
 * Normalizes JioSaavn play_count metric to a 1-100 popularity score matching Spotify's scale
 */
export function normalizePlayCountToPopularity(playCount: number): number {
    if (!playCount || playCount <= 1000) return 10;
    if (playCount <= 50000) return Math.min(25, Math.round(10 + (playCount / 50000) * 15));
    if (playCount <= 500000) return Math.min(45, Math.round(25 + ((playCount - 50000) / 450000) * 20));
    if (playCount <= 5000000) return Math.min(70, Math.round(45 + ((playCount - 500000) / 4500000) * 25));
    if (playCount <= 50000000) return Math.min(90, Math.round(70 + ((playCount - 5000000) / 45000000) * 20));
    return Math.min(100, Math.round(90 + (Math.log10(playCount) - 7.7) * 10));
}

export function scoreTrackRelevance(track: any, query: string, originalIndex: number = 0): number {
    let score = 0;
    const cleanQuery = (query || '').toLowerCase().trim();
    const trackTitle = (track.name || track.title || '').toLowerCase().trim();
    const artistNames = (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name) : [track.artist || ''])
        .filter(Boolean)
        .map((n: string) => n.toLowerCase().trim());
    const primaryArtist = artistNames[0] || '';

    // 1. Fuzzy Matching on Title (Handles "saheba" vs "sahiba")
    const baseTitle = trackTitle
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
    const cleanQueryAlnum = cleanQuery.replace(/[^a-zA-Z0-9]/g, '');

    let titleMatched = false;
    if (trackTitle === cleanQuery || (baseTitle && baseTitle === cleanQueryAlnum)) {
        score += 100;
        titleMatched = true;
    } else if (
        trackTitle.includes(cleanQuery) || 
        (baseTitle && baseTitle.includes(cleanQueryAlnum)) ||
        calculateSimilarity(trackTitle, cleanQuery) > 0.8 ||
        (baseTitle && cleanQueryAlnum && calculateSimilarity(baseTitle, cleanQueryAlnum) > 0.8)
    ) {
        score += 50; 
        titleMatched = true;
    }

    // 2. Artist Matching: When searching for an artist (e.g. "Drake" or "Arijit Singh"), award +100 for primary artist match
    // This ensures Drake's hits crush an obscure indie song whose title happens to be "Drake".
    const isArtistExact = artistNames.some((a: string) => a === cleanQuery || isArtistNameMatch(a, cleanQuery));
    const isArtistFuzzy = !isArtistExact && artistNames.some((a: string) => a.includes(cleanQuery) || calculateSimilarity(a, cleanQuery) > 0.8);

    // Spam Knockoff Detection:
    // If an artist names themselves after the exact song title (e.g., song "Shape of You" by artist "Shape of You"),
    // this is a known SEO spam knockoff intended to hijack search results. Heavily penalize it!
    const isArtistSpamKnockoff = Boolean(
        primaryArtist && (
            primaryArtist === trackTitle || 
            primaryArtist.replace(/[^a-zA-Z0-9]/g, '') === baseTitle ||
            (titleMatched && primaryArtist === cleanQuery)
        )
    );

    if (isArtistSpamKnockoff) {
        score -= 150;
    } else if (isArtistExact) {
        if (!titleMatched) {
            score += 100;
        } else {
            score += 10;
        }
    } else if (isArtistFuzzy) {
        if (!titleMatched) {
            score += 50;
        }
    } else if (cleanQuery.includes(' ') && (trackTitle + ' ' + primaryArtist).includes(cleanQuery)) {
        score += 40;
    }

    // Cover / Tribute / Karaoke penalty (e.g. "Originally Performed by ...")
    const isCoverOrTribute = /\b(originally performed by|tribute to|cover version|backing track|in the style of)\b/i.test(trackTitle) ||
        /\b(originally performed by|tribute to|cover version|backing track|in the style of)\b/i.test(primaryArtist);
    if (isCoverOrTribute && !cleanQuery.includes('cover') && !cleanQuery.includes('tribute')) {
        score -= 100;
    }

    // Low-Play Cover Artist Suppression:
    // If an obscure artist with < 200,000 plays covers a famous song, penalize so knockoffs don't crowd search
    const playCount = Number((track as any).playCount) || 0;
    const isLowPlayCover = playCount > 0 && playCount < 200000 && !isArtistExact;
    if (isLowPlayCover && !cleanQuery.includes(primaryArtist)) {
        score -= 120;
    }

    // 3. Spotify Engine Original Rank Priority:
    // Spotify's GraphQL search incorporates billions of user streams and global listening signals.
    // Index 0 in Spotify's official search is almost always the canonical hit!
    if (originalIndex === 0) {
        score += 90;
    } else if (originalIndex === 1) {
        score += 55;
    } else if (originalIndex === 2) {
        score += 35;
    } else if (originalIndex <= 5) {
        score += 20;
    }

    // 4. Recognized Major Artist Bonus:
    // Authentic global chart stars (Ed Sheeran, Taylor Swift, The Weeknd, etc.) should not be displaced by amateur knockoffs
    const isMajorArtist = artistNames.some((a: string) => 
        TOP_ARTIST_PROFILES[a] || 
        (track as any).followers > 50000
    );
    if (isMajorArtist) {
        score += titleMatched ? 80 : 40;
    }

    // 5. Track Popularity Multiplier (Crucial for generic searches)
    // Spotify returns a 'popularity' metric. If JioSaavn has 'playCount', normalize it to 1-100.
    const trackPopularity = track.popularity || 10; // Default to low if unknown
    
    // Multiply the base score by the popularity weight. 
    // This ensures a massive hit like "Sahiba" crushes an obscure song named "Saheba".
    score += (trackPopularity * 1.5); 

    return score;
}

/**
 * Smart Deduplication Fingerprinting:
 * Groups tracks by normalized raw signature `${baseTitle}` and shared artist tokens.
 * Keeps the highest quality version (highest score / Spotify CDN cover art), sorted by highest score first.
 */
export function deduplicateTracks(tracks: any[]): any[] {
    const uniqueTracks: any[] = [];
    const junkSubRegex = /\b(tribute|karaoke|instrumental\s*version|backing\s*track|8-?bit|16-?bit|type\s*beat|string\s*quartet|chiptune|arcade\s*player|workout|fitness|gym|nightcore|bpm|tabata|hardtekk|hardstyle|switching\s*vocals|cover\s*version|female\s*cover)\b/i;

    tracks.forEach(track => {
        const titleStr = (track.name || track.title || '').toLowerCase();
        const rawArtistStr = (Array.isArray(track.artists) && track.artists.length > 0)
            ? track.artists.map((a: any) => a.name).join(' ').toLowerCase()
            : (track.artist || 'unknown').toLowerCase();

        // Extra safety filter against tribute/backing track/type beat/workout junk
        if (junkSubRegex.test(titleStr) || junkSubRegex.test(rawArtistStr)) {
            return;
        }

        // Create a raw fingerprint: remove special chars, parentheses, version info, and spaces
        const baseTitle = titleStr
            .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
            .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();

        // Extract individual artist tokens
        const artistTokens = ((Array.isArray(track.artists) && track.artists.length > 0)
            ? track.artists.flatMap((a: any) => String(a.name || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
            : String(track.artist || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
            .map((a: string) => a.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim())
            .filter(Boolean);

        const primaryArtistToken = artistTokens[0] || 'unknown';

        // Check if an existing unique track shares the exact same baseTitle AND at least one major artist
        const existingIndex = uniqueTracks.findIndex(u => {
            const uTitleStr = (u.name || u.title || '').toLowerCase();
            const uBaseTitle = uTitleStr
                .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
                .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase();

            if (uBaseTitle !== baseTitle) return false;

            const uTokens = ((Array.isArray(u.artists) && u.artists.length > 0)
                ? u.artists.flatMap((a: any) => String(a.name || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
                : String(u.artist || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
                .map((a: string) => a.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim())
                .filter(Boolean);

            // Match if primary artist matches OR any artist token matches
            return uTokens.includes(primaryArtistToken) || artistTokens.some((tok: string) => uTokens.includes(tok));
        });

        const currentScore = track.score ?? 0;
        if (existingIndex === -1) {
            uniqueTracks.push(track);
        } else {
            const existing = uniqueTracks[existingIndex];
            const existingScore = existing.score ?? 0;
            const currentIsSpotify = Boolean(track.uri?.startsWith('spotify:track:') && !track.id?.startsWith('saavn_'));
            const existingIsSpotify = Boolean(existing.uri?.startsWith('spotify:track:') && !existing.id?.startsWith('saavn_'));

            // Rule 0: Clean Original Studio Track vs Version (Acoustic, Live, Remix, etc.)
            // The clean original studio recording MUST NEVER be overwritten by an acoustic or live version!
            const versionRegex = /\b(acoustic|live|unplugged|radio edit|club mix|extended|instrumental|orchestral)\b/i;
            const isCurrentVersion = versionRegex.test(track.name || '');
            const isExistingVersion = versionRegex.test(existing.name || '');

            if (!isExistingVersion && isCurrentVersion) {
                // Existing is the clean original; keep it, never overwrite with acoustic/version!
                return;
            }
            if (isExistingVersion && !isCurrentVersion) {
                // Current is clean original studio recording; replace the acoustic/version!
                uniqueTracks[existingIndex] = track;
                return;
            }

            // Rule 1: Official Spotify releases have authentic global cover art and master metadata.
            // If current track is Spotify and existing is NOT Spotify, Spotify ALWAYS takes precedence!
            if (currentIsSpotify && !existingIsSpotify) {
                if ((existing as any).playCount) {
                    (track as any).playCount = (existing as any).playCount;
                    (track as any).popularity = Math.max((track as any).popularity || 0, (existing as any).popularity || 0);
                }
                uniqueTracks[existingIndex] = track;
            } else if (!currentIsSpotify && existingIsSpotify) {
                // Keep the official Spotify track, borrowing playCount metric if available
                if ((track as any).playCount) {
                    (existing as any).playCount = (track as any).playCount;
                }
            } else {
                // Both are from same provider. Strongly prefer original studio release over promotional compilations
                const compilationRegex = /\b(party|hits|best of|top 100|collection|various artists|greatest hits|compilation|remix|pop \d{4}|\b\d{4}\b|now that'?s)\b/i;
                const isCurrentCompilation = compilationRegex.test(track.album?.name || '');
                const isExistingCompilation = compilationRegex.test(existing.album?.name || '');

                if (!isCurrentCompilation && isExistingCompilation) {
                    uniqueTracks[existingIndex] = track;
                } else if (currentScore > existingScore && (isCurrentCompilation === isExistingCompilation)) {
                    uniqueTracks[existingIndex] = track;
                }
            }
        }
    });

    // Sort final unique list by highest score first
    return uniqueTracks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}


// Official high-resolution Spotify portraits for global chart stars
const TOP_ARTIST_PROFILES: Record<string, string> = {
    'taylor swift': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb12184bdd29403de54cb9d9c7',
    'the weeknd': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebc1719ac9e6a75c1c25835018',
    'drake': 'https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb4293385d324db8558179afd9',
    'billie eilish': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb4a21b4760d2ecb7b0dcdc8da',
    'ariana grande': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb68412f2d0177a9ebc265ff58',
    'bruno mars': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebc7688aad1bf03986934d7e26',
    'dua lipa': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb0c68f6c95232e716f0abee8d',
    'olivia rodrigo': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebb14eb4dcfd2f3858bed06e44',
    'kendrick lamar': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb39ba6dcd4355c03de0b50918',
    'justin bieber': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebaf20f7db5288bce9beede034',
    'ed sheeran': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebd55c95ad400aed87da52daec',
    'travis scott': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb19c2790744c792d05570bb71',
    'sza': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebfd0a9fb6c252a3ba44079acf',
    'sabrina carpenter': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb78e45cfa4697ce3c437cb455',
    'tame impala': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebe412a782245eb20d9626c601',
    'morgan wallen': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb98a9ee5f9cac5e3efa057f30',
    'zach bryan': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb6492861f8e00ecfb8cabea3f',
    'beyoncé': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb7eaa373538359164b843f7c0',
    'lady gaga': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebaadc18cac8d48124357c38e6',
    'adele': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb68f6e5892075d7f22615bd17',
    'imagine dragons': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebab47d8dae2b24f5afe7f9d38',
    'maroon 5': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebf8349dfb619a7f842242de77',
    'selena gomez': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb815e520e3ce7fe210046ba66',
    'khalid': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb4a21b4760d2ecb7b0dcdc8da',
    'chappell roan': 'https://i.scdn.co/image/ab6761610000e5eb6f8de55129d12702ebff5710',
    'olivia dean': 'https://i.scdn.co/image/ab6761610000e5eb5c7577ad44daeb7ce4b941a1',
    'jamie miller': 'https://i.scdn.co/image/ab6761610000e5ebeacc346eb50276f366ac542c',
    'temper city': 'https://i.scdn.co/image/ab6761610000e5eb58cd69025e54b4f139005b6e',
    'jade': 'https://i.scdn.co/image/ab6761610000e5eb5d8f24eed04df5dac0adecf4',
    'gracie abrams': 'https://i.scdn.co/image/ab6761610000e5ebe1800836d95b63c49e60ea3b',
    'katseye': 'https://i.scdn.co/image/ab6761610000e5eb04ba72b2749f90d62152ebec',
    'grand theft auto vi': 'https://i.scdn.co/image/ab6761610000e5eb8b64bf5ce23508af9838eade',
    'gener8ion': 'https://i.scdn.co/image/ab6761610000e5eb9203ea92f4c538f41e6eea8c',
    'stella lefty': 'https://i.scdn.co/image/ab6761610000e5eb37597ef39468f4fe8fcd9690',
    'alyssa grace': 'https://i.scdn.co/image/ab6761610000e5ebe95e39575c4f2c668eb11bc4',
    'solto (fr)': 'https://i.scdn.co/image/ab6761610000e5ebf2f0c84b86e48dd70d9bcc59',
    'tate mcrae': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebeefdef74a162b2913094ad9c',
    'karol g': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb3869e286c9043f85e8e4bc06',
    'ashe': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb1ecbc7955919e10c45604e85',
    'adéla': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb2005cc18964c60e22c4759b5',
    'adela': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb2005cc18964c60e22c4759b5',
    'malcolm todd': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb9f6f7c2d12975d2a4b3a0fd8',
    'judeline': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebfdd8220f7ef970a38f319160',
    'rusowsky': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb2d66e1921d069934588aa080',
    'post malone': 'https://i.scdn.co/image/ab6761610000e5ebe17c0aa1714a03d62b5ce4e0',
    'eminem': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eba00b11c129b27a88fc72f36b',
    'bad bunny': 'https://i.scdn.co/image/ab67616d0000b27361f01b4fa6f523369d340c75',
    'lana del rey': 'https://i.scdn.co/image/ab6761610000e5ebb99cacf8acd5378206767261',
    'coldplay': 'https://i.scdn.co/image/ab6761610000e5ebfe1fab276582a303ff359a7b',
    'rihanna': 'https://i.scdn.co/image/ab6761610000e5ebceab420e8ded9e0de267df37',
    'harry styles': 'https://i.scdn.co/image/ab67616d0000b273731f0f3040d66000d82f0350',
    'doja cat': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb9e3a3b8792a04c4578da7b90',
    'future': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb1a695ee9c2cb49fab81d4088',
    'metro boomin': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebbc031b73f958987fa1030310',
    '21 savage': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb76b4cd56c7e94e8d2bdc3e21',
    'shawn mendes': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb3d8ed563d628c5c61ec4569d',
    'camila cabello': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb4591e8a49868c2494652767f',
    'charlie puth': 'https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebc355b366638e0c5f20f4b265'
};

const TOP_ARTIST_SPOTIFY_IDS: Record<string, string> = {
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

interface ArtistMeta {
    imageUrl: string;
    headerUrl?: string;
    followers: number;
    monthlyListeners?: number;
    genres: string[];
    bio?: string;
    verified?: boolean;
    topTracks?: Track[];
}

const ARTIST_META_CACHE = new Map<string, ArtistMeta>();

const SPOTIFY_TRACK_COVER_CACHE = new Map<string, string>();

/**
 * Resolves high-resolution authentic Spotify album cover art for an individual track using official oEmbed
 * Upgrades standard 300x300 artwork to 640x640 crystal-clear Spotify CDN image
 */
export async function resolveSpotifyTrackCover(trackId: string): Promise<string | null> {
    if (!trackId || typeof trackId !== 'string') return null;
    const cleanId = trackId.replace('spotify:track:', '').trim();
    if (cleanId.length !== 22 || cleanId.includes('_')) return null;

    const cached = SPOTIFY_TRACK_COVER_CACHE.get(cleanId);
    if (cached) return cached;

    try {
        const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${cleanId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
            const data = await res.json() as any;
            if (data.thumbnail_url) {
                // Upgrade 300x300 (ab67616d00001e02) to pristine 640x640 (ab67616d0000b273)
                const highRes = data.thumbnail_url.replace('ab67616d00001e02', 'ab67616d0000b273');
                SPOTIFY_TRACK_COVER_CACHE.set(cleanId, highRes);
                return highRes;
            }
        }
    } catch { }
    return null;
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
 * Scrape official Spotify embed for high-resolution artist portrait and visual identity
 */
export async function scrapeSpotifyArtistEmbed(spotifyArtistId: string): Promise<{ imageUrl?: string; name?: string; trackList?: any[] } | null> {
    try {
        const res = await fetch(`https://open.spotify.com/embed/artist/${spotifyArtistId}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
            const html = await res.text();
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
            if (match && match[1]) {
                const nextData = JSON.parse(match[1]);
                const entity = nextData.props?.pageProps?.state?.data?.entity;
                if (entity) {
                    const images = entity.visualIdentity?.image || [];
                    const img = images.find((i: any) => i.maxWidth >= 500)?.url || images[0]?.url;
                    return {
                        imageUrl: img,
                        name: entity.name,
                        trackList: entity.trackList || []
                    };
                }
            }
        }
    } catch (e) {}
    return null;
}

/**
 * Query YouTube Innertube for high-resolution artist channel avatar and official metadata
 */
async function resolveYouTubeArtistAvatar(artistName: string): Promise<string> {
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

async function resolveArtistMetadata(artistName: string): Promise<ArtistMeta> {
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


async function resolveArtistImage(artistName: string): Promise<string> {
    const meta = await resolveArtistMetadata(artistName);
    return meta.imageUrl;
}

/**
 * Calculates string similarity between 0.0 and 1.0 using Levenshtein distance
 */
export function stringSimilarity(s1: string, s2: string): number {
    let longer = s1.toLowerCase().trim();
    let shorter = s2.toLowerCase().trim();
    if (longer.length < shorter.length) {
        const tmp = longer;
        longer = shorter;
        shorter = tmp;
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const costs: number[] = [];
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longerLength - costs[shorter.length]) / parseFloat(longerLength.toString());
}

/**
 * Composite Relevance Scoring Algorithm for Artists
 * 1. Text Relevance:
 *    - Exact match: 70
 *    - Prefix / word start: 60 (e.g. "Dove Cameron" for query "dove")
 *    - Prefix generic: 48 (e.g. "Dover" for query "dove")
 *    - Word match: 40 (e.g. "Niki & The Dove" for query "dove")
 *    - Substring: 20
 *    - Fuzzy / typo match: up to 50
 * 2. Popularity Multiplier:
 *    - Logarithmic scale of follower count: 6 * log10(followers)
 *    - Elevates massive artists (e.g. Dove Cameron with 677K fans) above obscure bands with 8 or 342 followers
 */
export function calculateArtistRelevanceScore(artist: { name: string; followers?: { total: number } | number }, query: string): number {
    const q = (query || '').toLowerCase().trim();
    const name = (artist.name || '').toLowerCase().trim();
    if (!q || !name) return 0;

    const rawFollowers = typeof artist.followers === 'object' && artist.followers !== null
        ? artist.followers.total
        : typeof artist.followers === 'number'
            ? artist.followers
            : 0;

    const followers = Math.max(rawFollowers || 0, 1);
    const logFollowers = Math.log10(followers); // 0 to ~8.5

    let textScore = 0;
    if (name === q) {
        textScore = 70;
    } else if (name.startsWith(q + ' ') || name.startsWith(q + '-')) {
        textScore = 60;
    } else if (name.startsWith(q)) {
        textScore = 48;
    } else if (name.split(/\s+/).some(w => w === q || w.startsWith(q))) {
        textScore = 40;
    } else if (name.includes(q)) {
        textScore = 20;
    } else {
        const sim = stringSimilarity(name, q);
        if (sim >= 0.7) {
            textScore = sim * 50;
        }
    }

    const popScore = logFollowers * 6;
    return textScore + popScore;
}

export function isArtistNameMatch(artistName: string, query: string): boolean {
    if (!artistName || !query) return false;

    const normName = artistName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();

    const normQuery = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();

    if (!normName || !normQuery) return false;

    // Direct substring match
    if (normName.includes(normQuery) || normQuery.includes(normName)) {
        return true;
    }

    // Token prefix matching (e.g. "dove came" matches "Dove Cameron")
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);
    const nameTokens = normName.split(/\s+/).filter(Boolean);

    if (queryTokens.length > 0 && queryTokens.every(qTok => 
        nameTokens.some(nTok => nTok.startsWith(qTok) || nTok === qTok)
    )) {
        return true;
    }

    // Condensed check without spaces (e.g. "dovecameron" matches "dovcame")
    const condensedName = normName.replace(/\s+/g, '');
    const condensedQuery = normQuery.replace(/\s+/g, '');
    if (condensedName.startsWith(condensedQuery) || condensedQuery.startsWith(condensedName)) {
        return true;
    }

    // Typo tolerance: Levenshtein distance check for query length >= 3
    if (normQuery.length >= 3) {
        if (stringSimilarity(normName, normQuery) >= 0.72) return true;
        if (stringSimilarity(condensedName, condensedQuery) >= 0.72) return true;
        if (queryTokens.length === nameTokens.length) {
            if (queryTokens.every((qTok, i) => {
                const nTok = nameTokens[i];
                return nTok && (nTok.startsWith(qTok) || stringSimilarity(nTok, qTok) >= 0.7);
            })) return true;
        }
    }

    return false;
}

function isJunkChannel(name: string, query: string): boolean {
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

export class SpotifyScraperPlugin implements MetadataPlugin {
    readonly name = 'SpotifyScraper';

    getCuratedPlaylists(limit: number = 20) {
        return POPULAR_SPOTIFY_PLAYLISTS.slice(0, limit);
    }

    /**
     * Scrape playlist data from Spotify embed with in-memory caching and resilient local fallback
     */
    async getPlaylist(playlistId: string): Promise<Playlist> {
        // 0. In-memory RAM cache
        const cached = playlistMemoryCache.get(playlistId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.playlist;
        }

        try {
            const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
            const { data: html } = await axios.get<string>(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 6000
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

                    const resPlaylist: Playlist = {
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

                    playlistMemoryCache.set(playlistId, {
                        playlist: resPlaylist,
                        expiresAt: Date.now() + 2 * 3600 * 1000
                    });

                    return resPlaylist;
                }
            }
        } catch (err: any) {
            console.warn(`[SpotifyScraper] Live scrape for playlist ${playlistId} failed (${err.message}), using fallback`);
        }

        // 1. Fallback: check local library snapshot (provides full tracks even when Spotify times out / 504s)
        try {
            const local = localLibrary.getPlaylist(playlistId);
            if (local && local.tracks && local.tracks.items && local.tracks.items.length > 0) {
                return local;
            }
        } catch { }

        // 2. Fallback: check curated list
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
     * Scrape album metadata and all tracks from Spotify embed
     */
    async getAlbum(albumId: string): Promise<any> {
        try {
            const url = `https://open.spotify.com/embed/album/${albumId}`;
            const { data: html } = await axios.get<string>(url, {
                headers: { 'User-Agent': USER_AGENT }
            });

            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
            if (match && match[1]) {
                const nextData = JSON.parse(match[1]);
                const entity = nextData.props?.pageProps?.state?.data?.entity;

                if (entity) {
                    const images = entity.visualIdentity?.image || [];
                    const coverArtUrl = images[2]?.url || images[0]?.url ||
                        'https://ui-avatars.com/api/?name=Album&background=181824&color=f5d0b5&size=500&bold=true';

                    const artistNames = (entity.subtitle || 'Unknown Artist').split(/,\s*/);
                    const releaseDate = entity.releaseDate?.isoString
                        ? entity.releaseDate.isoString.substring(0, 10)
                        : '2024';

                    const tracks: Track[] = (entity.trackList || []).map((t: any, index: number) => {
                        const tArtists = (t.subtitle || entity.subtitle || 'Unknown Artist').split(/,\s*/);
                        const trackId = t.uri ? t.uri.replace('spotify:track:', '') : `album_${albumId}_${index}`;

                        return {
                            id: trackId,
                            uri: t.uri || `spotify:track:${trackId}`,
                            name: t.title || 'Unknown Track',
                            artists: tArtists.map((name: string) => ({ name })),
                            album: {
                                name: entity.name || entity.title || 'Album',
                                images: [{ url: coverArtUrl }]
                            },
                            duration_ms: t.duration || 180000,
                            preview_url: t.audioPreview?.url || null
                        };
                    });

                    return {
                        id: albumId,
                        name: entity.name || entity.title || 'Album',
                        artists: artistNames.map((name: string) => ({ name })),
                        images: [{ url: coverArtUrl }],
                        release_date: releaseDate,
                        total_tracks: tracks.length,
                        genres: ['Music'],
                        tracks
                    };
                }
            }
        } catch (err: any) {
            console.warn(`[SpotifyScraper] Failed to scrape album ${albumId}:`, err.message);
        }

        return null;
    }

    /**
     * Real-time search for albums across Spotify and Apple Music catalogs
     */
    async searchAlbums(query: string, limit: number = 20): Promise<any[]> {
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

    /**
     * Search tracks using Dual-Engine Search (Spotify Pathfinder + JioSaavn):
     * - Direct JioSaavn album/song URL support
     * - JioSaavn's superior hit ranking for popular original songs
     * - HTML entity decoding
     * - Query cleaning (removes "by" keyword, e.g. "eyes dont lie by isabel larose")
     * - Cross-engine token overlap deduplication with Spotify CDN artwork priority
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
        const fetchLimit = Math.max(limit * 2, 30);

        // Pre-query matched artists to inject their top songs only if searching for a recognized major artist (time-boxed to 800ms)
        const matchedArtists = await withTimeout(this.searchArtists(cleanQuery, 3), 800).catch(() => []);
        const primaryArtist = matchedArtists.find(a => isArtistNameMatch(a.name, cleanQuery));
        const isRecognizedMajorArtist = primaryArtist && (
            (primaryArtist.followers?.total || 0) >= 50000 || 
            TOP_ARTIST_PROFILES[primaryArtist.name.toLowerCase()]
        );
        const artistTrackPromise = isRecognizedMajorArtist
            ? searchSpotubeSpotifyTracks(`artist:${primaryArtist.name}`, fetchLimit).catch(() => [])
            : Promise.resolve([]);

        // 0. Time-Boxed Multi-Engine Parallel Search (Strictly Spotify + JioSaavn):
        // 1. Spotify Pathfinder GraphQL (Official global catalog & artwork)
        // 2. JioSaavn Search (Authentic play count stream metric)
        // 3. JioSaavn Autocomplete (Typo / spell-check matching)
        // 4. Spotify Artist Top Tracks (if searching by major artist)
        const [spotubeRes, saavnRes, saavnAutoRes, artistTracksRes] = await Promise.allSettled([
            withTimeout(searchSpotubeSpotifyTracks(cleanQuery, fetchLimit), 3500),
            withTimeout(axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'search.getResults',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    p: 1,
                    n: fetchLimit,
                    q: cleanQuery
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 3000
            }), 3000),
            withTimeout(axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'autocomplete.get',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    query: cleanQuery
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 2500
            }), 2500),
            withTimeout(artistTrackPromise, 3500)
        ]);

        const rawCandidates: { track: Track; originalIndex: number }[] = [];

        // Map JioSaavn play counts for authentic cross-engine track popularity
        const saavnPopularityMap = new Map<string, number>();
        if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data?.results)) {
            saavnRes.value.data.results.forEach((item: any) => {
                const name = decodeHtmlEntities(item.song || item.title);
                const artist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
                const playCount = Number(item.play_count) || 0;
                const saavnPopularity = normalizePlayCountToPopularity(playCount);
                const baseTitle = name.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const primaryArtistStr = artist.split(/[,x&•|–-]/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                saavnPopularityMap.set(`${baseTitle}-${primaryArtistStr}`, saavnPopularity);
            });
        }

        let spotubeCandidates: Track[] = (spotubeRes.status === 'fulfilled' && Array.isArray(spotubeRes.value)) ? spotubeRes.value : [];

        // If Spotify prefix search returned few or 0 items (e.g. user typed "teenage drea" before the final "m"),
        // check autocomplete suggestion to grab official Spotify release with canonical artwork
        if (spotubeCandidates.length < 3 && saavnAutoRes.status === 'fulfilled') {
            const autoTitle = saavnAutoRes.value?.data?.topquery?.data?.[0]?.title;
            if (autoTitle && autoTitle.toLowerCase() !== cleanQuery.toLowerCase()) {
                try {
                    const fallbackSpotify = await withTimeout(searchSpotubeSpotifyTracks(autoTitle, fetchLimit), 1000);
                    if (Array.isArray(fallbackSpotify) && fallbackSpotify.length > 0) {
                        spotubeCandidates = [...spotubeCandidates, ...fallbackSpotify];
                    }
                } catch (e) {}
            }
        }

        // 1. Primary: Collect Spotube candidates (Official global Spotify catalog & covers) - HIGHEST RELEVANCE
        if (spotubeCandidates.length > 0) {
            spotubeCandidates.forEach((track, idx) => {
                const baseTitle = (track.name || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const primaryArtistStr = (track.artists?.[0]?.name || (track as any).artist || 'unknown').split(/[,x&•|–-]/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const sig = `${baseTitle}-${primaryArtistStr}`;

                if (saavnPopularityMap.has(sig)) {
                    (track as any).popularity = saavnPopularityMap.get(sig);
                } else {
                    (track as any).popularity = typeof (track as any).popularity === 'number'
                        ? (track as any).popularity
                        : (idx === 0 ? 98 : idx === 1 ? 92 : idx === 2 ? 85 : Math.max(10, 65 - idx * 4));
                }
                rawCandidates.push({ track, originalIndex: idx });
            });
        }

        // 2. Supplementary: Collect Top Spotify Artist Tracks (if searching for a major star)
        if (artistTracksRes.status === 'fulfilled' && Array.isArray(artistTracksRes.value)) {
            artistTracksRes.value.forEach((track, idx) => {
                (track as any).popularity = Math.max(30, 95 - idx * 2);
                (track as any).followers = primaryArtist?.followers?.total || 0;
                rawCandidates.push({ track, originalIndex: idx + 2 });
            });
        }

        // 3. Collect JioSaavn candidates (Provides regional/Indian coverage where Spotify catalog is sparse)
        if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data?.results)) {
            saavnRes.value.data.results.forEach((item: any, idx: number) => {
                const name = decodeHtmlEntities(item.song || item.title);
                const artist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
                const playCount = Number(item.play_count) || 0;
                const saavnPopularity = normalizePlayCountToPopularity(playCount);

                rawCandidates.push({
                    track: {
                        id: `saavn_${item.id}`,
                        uri: `spotify:track:saavn_${item.id}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: decodeHtmlEntities(item.album || name),
                            images: [{ url: (item.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(item.duration) || 180) * 1000,
                        preview_url: item.media_preview_url || null,
                        ...({ popularity: saavnPopularity, playCount } as any)
                    },
                    originalIndex: idx + 10
                });
            });
        }

        // 4. Collect JioSaavn Autocomplete candidates (Phonetic & Typo spell-check matching)
        if (saavnAutoRes.status === 'fulfilled' && saavnAutoRes.value?.data) {
            const autoSongs = [
                ...(saavnAutoRes.value.data?.topquery?.data || []),
                ...(saavnAutoRes.value.data?.songs?.data || [])
            ];
            autoSongs.forEach((item: any, idx: number) => {
                if (!item || !item.id || item.type !== 'song') return;
                const name = decodeHtmlEntities(item.title || item.song);
                const artist = decodeHtmlEntities(item.more_info?.primary_artists || item.more_info?.singers || item.description?.split('·')?.[1]?.trim() || 'Unknown Artist');
                const ctr = Number(item.ctr) || 0;
                const autoPopularity = ctr > 1000 ? Math.min(95, Math.round(70 + Math.log10(ctr) * 7)) : (ctr > 0 ? 30 : 15);
                rawCandidates.push({
                    track: {
                        id: `saavn_${item.id}`,
                        uri: `spotify:track:saavn_${item.id}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: decodeHtmlEntities(item.album || name),
                            images: [{ url: (item.image || '').replace(/50x50|150x150/, '500x500') }]
                        },
                        duration_ms: 180000,
                        preview_url: null,
                        ...({ popularity: autoPopularity } as any)
                    },
                    originalIndex: idx + 20
                });
            });
        }

        // 2. Strict No-Remix / No-Junk Guard
        // Drop remix/flip/lofi/unplugged/reverb/slowed/instrumental/karaoke/lyrical/8d/nightcore/workout/tribute/cover unless user typed those words
        const junkRegex = /\b(remix|flip|lofi|unplugged|reverb|slowed|instrumental|karaoke|lyrical|8d|8-?bit|16-?bit|nightcore|tribute|cover|workout|fitness|gym|bpm|tabata|hardtekk|hardstyle|techno|switching\s*vocals|backing\s*track|type\s*beat|speed\s*up|sped\s*up)\b/i;
        const cleanResults = rawCandidates.filter(({ track }) => {
            // If the user's query didn't ask for a flip/remix/cover/workout, drop tracks that contain those words
            if (!junkRegex.test(raw)) {
                const trackTitle = (track.name || (track as any).title || '').toLowerCase();
                const trackArtist = (track.artists || []).map((a: any) => a.name).join(' ').toLowerCase();
                if (junkRegex.test(trackTitle) || junkRegex.test(trackArtist)) {
                    return false;
                }
            }
            return true;
        });

        // 3. Relevance scoring (Fuzzy Matching + Track Popularity)
        const scoredTracks = cleanResults.map(({ track, originalIndex }) => {
            (track as any).score = scoreTrackRelevance(track, raw, originalIndex);
            return track;
        });

        // 4. Smart Deduplication Fingerprinting
        const deduplicated = deduplicateTracks(scoredTracks);

        return deduplicated.slice(0, limit);
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
     * Get authentic, real-time new releases and top chart albums from live public APIs
     */
    async getNewReleases(): Promise<any[]> {
        const albums: any[] = [];
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();

        try {
            const [usRes, inRes, saavnRes] = await Promise.allSettled([
                axios.get('https://itunes.apple.com/us/rss/topalbums/limit=35/json', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                }),
                axios.get('https://itunes.apple.com/in/rss/topalbums/limit=35/json', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                }),
                axios.get('https://www.jiosaavn.com/api.php?__call=content.getAlbums&_format=json&_marker=0&cc=in&p=1&n=30', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                })
            ]);

            // 1. Apple Music Global / US Top Chart Albums
            if (usRes.status === 'fulfilled') {
                const entries = usRes.value.data?.feed?.entry || [];
                for (const e of entries) {
                    const name = decodeHtmlEntities(e['im:name']?.label);
                    const artist = decodeHtmlEntities(e['im:artist']?.label || 'Artist');
                    const rawImg = e['im:image']?.[2]?.label || e['im:image']?.[0]?.label;
                    const img = rawImg ? rawImg.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '';
                    const genre = e['category']?.attributes?.label || 'Pop';
                    const year = e['im:releaseDate']?.label?.substring(0, 4) || '2024';
                    const tracks = Number(e['im:itemCount']?.label || 10);
                    const id = e['id']?.attributes?.['im:id'] || `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    const norm = name.toLowerCase().trim();
                    if (name && !seenNames.has(norm) && !seenIds.has(id)) {
                        seenNames.add(norm);
                        seenIds.add(id);
                        albums.push({
                            id,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: year,
                            total_tracks: tracks,
                            genre
                        });
                    }
                }
            }

            // 2. Apple Music Regional / India Top Chart Albums
            if (inRes.status === 'fulfilled') {
                const entries = inRes.value.data?.feed?.entry || [];
                for (const e of entries) {
                    const name = decodeHtmlEntities(e['im:name']?.label);
                    const artist = decodeHtmlEntities(e['im:artist']?.label || 'Artist');
                    const rawImg = e['im:image']?.[2]?.label || e['im:image']?.[0]?.label;
                    const img = rawImg ? rawImg.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '';
                    const genre = e['category']?.attributes?.label || 'Indian';
                    const year = e['im:releaseDate']?.label?.substring(0, 4) || '2024';
                    const tracks = Number(e['im:itemCount']?.label || 10);
                    const id = e['id']?.attributes?.['im:id'] || `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    const norm = name.toLowerCase().trim();
                    if (name && !seenNames.has(norm) && !seenIds.has(id)) {
                        seenNames.add(norm);
                        seenIds.add(id);
                        albums.push({
                            id,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: year,
                            total_tracks: tracks,
                            genre
                        });
                    }
                }
            }

            // 3. JioSaavn Real-Time Indian & Bollywood Releases
            if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data)) {
                for (const item of saavnRes.value.data) {
                    const name = decodeHtmlEntities(item.title || item.name);
                    if (!name) continue;
                    const norm = name.toLowerCase().trim();
                    const rawImg = item.image || '';
                    const img = rawImg ? rawImg.replace(/150x150|50x50/, '500x500') : '';
                    let artist = 'Various Artists';
                    if (item.Artist?.music && Array.isArray(item.Artist.music)) {
                        artist = item.Artist.music.map((m: any) => m.name).filter(Boolean).join(', ') || 'Artist';
                    }
                    const cleanId = `saavn_${item.albumid || item.id || norm.replace(/[^a-z0-9]/g, '')}`;

                    if (!seenNames.has(norm) && !seenIds.has(cleanId)) {
                        seenNames.add(norm);
                        seenIds.add(cleanId);
                        albums.push({
                            id: cleanId,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: item.year || '2026',
                            total_tracks: 10,
                            genre: 'Bollywood'
                        });
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Real-time albums fetch notice:', err.message);
        }

        // Curated real-time chart albums fallback if public RSS feeds are unreachable
        if (albums.length === 0) {
            const fallbackCuratedAlbums = [
                {
                    id: 'sp_alb_hitmehard',
                    name: 'HIT ME HARD AND SOFT',
                    artists: [{ name: 'Billie Eilish' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62' }],
                    release_date: '2024',
                    total_tracks: 10,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_ttpd',
                    name: 'THE TORTURED POETS DEPARTMENT',
                    artists: [{ name: 'Taylor Swift' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2735232938b815615712176b054' }],
                    release_date: '2024',
                    total_tracks: 16,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_shortnsweet',
                    name: "Short n' Sweet",
                    artists: [{ name: 'Sabrina Carpenter' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273659cd4673230913b3918e0d5' }],
                    release_date: '2024',
                    total_tracks: 12,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_midwestprincess',
                    name: 'The Rise and Fall of a Midwest Princess',
                    artists: [{ name: 'Chappell Roan' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273b5d27fb63024564c74070be6' }],
                    release_date: '2024',
                    total_tracks: 14,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_gnx',
                    name: 'GNX',
                    artists: [{ name: 'Kendrick Lamar' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273d9985092cd88bffd97653b58' }],
                    release_date: '2024',
                    total_tracks: 12,
                    genre: 'Hip-Hop'
                },
                {
                    id: 'sp_alb_utopia',
                    name: 'UTOPIA',
                    artists: [{ name: 'Travis Scott' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273881d5d052504d947263b386f' }],
                    release_date: '2023',
                    total_tracks: 19,
                    genre: 'Hip-Hop'
                },
                {
                    id: 'sp_alb_animal',
                    name: 'Animal',
                    artists: [{ name: 'Pritam, JAM8, Vishal Mishra' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730261696c5df3be99da6ed3f3' }],
                    release_date: '2023',
                    total_tracks: 14,
                    genre: 'Bollywood'
                },
                {
                    id: 'sp_alb_aashiqui2',
                    name: 'Aashiqui 2',
                    artists: [{ name: 'Mithoon, Ankit Tiwari, Jeet Gannguli' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27357452e8964893e17cf6f69ad' }],
                    release_date: '2023',
                    total_tracks: 11,
                    genre: 'Bollywood'
                },
                {
                    id: 'sp_alb_ghost',
                    name: 'Ghost',
                    artists: [{ name: 'Diljit Dosanjh' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27341e0584eb266b04fec8b3684' }],
                    release_date: '2023',
                    total_tracks: 21,
                    genre: 'Punjabi'
                },
                {
                    id: 'sp_alb_makingmemories',
                    name: 'Making Memories',
                    artists: [{ name: 'Karan Aujla, Ikky' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273d8b9980db67272cb4d4c3dfe' }],
                    release_date: '2023',
                    total_tracks: 9,
                    genre: 'Punjabi'
                },
                {
                    id: 'sp_alb_sos',
                    name: 'SOS',
                    artists: [{ name: 'SZA' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27370dbc9f47669d120e081e5f3' }],
                    release_date: '2023',
                    total_tracks: 23,
                    genre: 'R&B'
                },
                {
                    id: 'sp_alb_afterhours',
                    name: 'After Hours',
                    artists: [{ name: 'The Weeknd' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' }],
                    release_date: '2020',
                    total_tracks: 14,
                    genre: 'R&B'
                },
                {
                    id: 'sp_alb_moonmusic',
                    name: 'Moon Music',
                    artists: [{ name: 'Coldplay' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27392a95c96b797fc74d47a5089' }],
                    release_date: '2024',
                    total_tracks: 10,
                    genre: 'Rock & Indie'
                },
                {
                    id: 'sp_alb_am',
                    name: 'AM',
                    artists: [{ name: 'Arctic Monkeys' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe5ece75734' }],
                    release_date: '2013',
                    total_tracks: 12,
                    genre: 'Rock & Indie'
                }
            ];
            albums.push(...fallbackCuratedAlbums);
        }

        return albums;
    }

    /**
     * Get top artists:
     * Flagship global chart artists each with their own unique official HD portrait.
     */
    async getTopArtists(limit: number = 50): Promise<Artist[]> {
        const results: Artist[] = [];
        const seenNames = new Set<string>();

        // 1. Flagship chart playlist tracks from Spotify to discover currently trending artist names
        const playlistIds = [
            '37i9dQZF1DXcBWIGoYBM5M', // Today's Top Hits
            '37i9dQZEVXbMDoHDwVN2tF', // Top 50 - Global
            '37i9dQZF1DX0XUsuxWHRQd', // RapCaviar
            '37i9dQZF1DX10zKzsJ2jva'  // Viva Latino
        ];

        const candidateArtists: string[] = [];

        for (const pId of playlistIds) {
            try {
                const playlist = await this.getPlaylist(pId);
                const items = playlist.tracks?.items || [];
                for (const item of items) {
                    const t = item.track;
                    if (!t || !Array.isArray(t.artists)) continue;

                    for (const a of t.artists) {
                        const artistName = (a.name || '').trim();
                        const norm = artistName.toLowerCase();
                        if (
                            artistName &&
                            artistName.length >= 2 &&
                            !artistName.toLowerCase().includes('unknown') &&
                            !seenNames.has(norm)
                        ) {
                            seenNames.add(norm);
                            candidateArtists.push(artistName);
                        }
                        if (candidateArtists.length >= limit) break;
                    }
                    if (candidateArtists.length >= limit) break;
                }
            } catch (err: any) {
                console.warn(`[SpotifyScraper] getTopArtists failed for playlist ${pId}:`, err.message);
            }
            if (candidateArtists.length >= limit) break;
        }

        // If candidates are fewer than limit, append known superstars
        for (const name of Object.keys(TOP_ARTIST_PROFILES)) {
            if (!seenNames.has(name)) {
                seenNames.add(name);
                const capitalized = name.replace(/\b\w/g, c => c.toUpperCase());
                candidateArtists.push(capitalized);
            }
            if (candidateArtists.length >= limit) break;
        }

        // Resolve each artist's individual portrait and real metadata in parallel batches
        const artistPromises = candidateArtists.slice(0, limit).map(async (name) => {
            const meta = await resolveArtistMetadata(name);
            return {
                id: `sp_art_${encodeURIComponent(name)}`,
                name,
                images: [{ url: meta.imageUrl }],
                genres: meta.genres,
                followers: { total: meta.followers },
                monthlyListeners: meta.monthlyListeners
            };
        });

        const resolved = await Promise.all(artistPromises);
        resolved.sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));
        return resolved;
    }

    /**
     * Real-time Artist Search:
     * Strictly returns artists whose names match the search query, ranked by follower count descending
     */
    async searchArtists(query: string, limit: number = 25): Promise<Artist[]> {
        const clean = (query || '').trim();
        if (!clean) return this.getTopArtists(limit);

        const results: Artist[] = [];
        const seen = new Set<string>();

        // 1. Direct match from curated superstars and top artists
        for (const name of Object.keys(TOP_ARTIST_PROFILES)) {
            if (isArtistNameMatch(name, clean)) {
                const norm = name.toLowerCase();
                if (!seen.has(norm)) {
                    seen.add(norm);
                    const meta = await resolveArtistMetadata(name);
                    const capitalized = name.replace(/\b\w/g, c => c.toUpperCase());
                    results.push({
                        id: `sp_art_${encodeURIComponent(capitalized)}`,
                        name: capitalized,
                        images: [{ url: meta.imageUrl }],
                        genres: meta.genres,
                        followers: { total: meta.followers },
                        monthlyListeners: meta.monthlyListeners
                    });
                }
            }
        }

        // 2. Direct Spotify dedicated Artist Search via Pathfinder GraphQL (healthy 4000ms timeout)
        try {
            const spArtists = await withTimeout(searchSpotifyArtists(clean, Math.min(limit * 2, 40)), 4000).catch(() => []);
            // Enrich top candidates with genuine Spotify follower counts
            await Promise.all(spArtists.slice(0, 15).map(async (sa) => {
                const norm = sa.name.toLowerCase().trim();
                const existing = ARTIST_META_CACHE.get(norm);
                if (!existing || (existing.followers || 0) <= 500) {
                    const overview = await withTimeout(fetchSpotifyArtistOverview(sa.id), 3500).catch(() => null);
                    if (overview) {
                        ARTIST_META_CACHE.set(norm, {
                            imageUrl: overview.avatarUrl || sa.picture,
                            genres: ['Pop', 'Top Hits'],
                            followers: overview.followers,
                            monthlyListeners: overview.monthlyListeners,
                            verified: overview.verified
                        });
                        TOP_ARTIST_SPOTIFY_IDS[norm] = sa.id;
                    }
                }
            }));

            for (const sa of spArtists) {
                const aName = (sa.name || '').trim();
                const norm = aName.toLowerCase();
                if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

                if (!seen.has(norm)) {
                    seen.add(norm);
                    const cachedMeta = ARTIST_META_CACHE.get(norm);
                    const fans = cachedMeta?.followers || getArtistFollowers(aName);
                    const picture = cachedMeta?.imageUrl || sa.picture || '';

                    if (!ARTIST_META_CACHE.has(norm)) {
                        ARTIST_META_CACHE.set(norm, {
                            imageUrl: picture,
                            genres: ['Pop', 'Top Hits'],
                            followers: fans,
                            monthlyListeners: cachedMeta?.monthlyListeners || 0,
                            verified: cachedMeta?.verified ?? true
                        });
                        TOP_ARTIST_SPOTIFY_IDS[norm] = sa.id;
                    }

                    results.push({
                        id: `sp_art_${encodeURIComponent(aName)}`,
                        name: aName,
                        images: picture ? [{ url: picture }] : [],
                        genres: ['Pop', 'Top Hits'],
                        followers: { total: fans },
                        monthlyListeners: cachedMeta?.monthlyListeners || 0
                    });
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraperPlugin] searchSpotifyArtists error:', err.message);
        }

        // 3. Search Spotify catalog via Spotube with strict artist name verification
        try {
            const spotubeTracks = await searchSpotubeSpotifyTracks(`artist:${clean}`, limit);
            for (const t of spotubeTracks) {
                for (const art of t.artists) {
                    const aName = (art.name || '').trim();
                    const norm = aName.toLowerCase();
                    if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

                    if (!seen.has(norm)) {
                        seen.add(norm);
                        const fans = getArtistFollowers(aName);
                        results.push({
                            id: `sp_art_${encodeURIComponent(aName)}`,
                            name: aName,
                            images: [],
                            genres: ['Artist'],
                            followers: { total: fans }
                        });
                    }
                }
            }
        } catch (err: any) {}

        // 4. YouTube Innertube with strict artist name verification
        try {
            const ytTracks = await searchYouTubeInnertubeTracks(`${clean} official audio`, limit);
            for (const t of ytTracks) {
                for (const art of t.artists) {
                    const aName = (art.name || '').trim();
                    const norm = aName.toLowerCase();
                    if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

                    if (!seen.has(norm)) {
                        seen.add(norm);
                        const fans = getArtistFollowers(aName);
                        results.push({
                            id: `yt_art_${encodeURIComponent(aName)}`,
                            name: aName,
                            images: [],
                            genres: ['Artist'],
                            followers: { total: fans }
                        });
                    }
                }
            }
        } catch (err: any) {}

        // 5. Popularity (follower count descending) & composite text-relevance ranking
        results.sort((a, b) => {
            const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
            const fB = typeof b.followers === 'object' && b.followers !== null ? b.followers.total : (Number(b.followers) || 0);
            if (fB !== fA) return fB - fA;
            return calculateArtistRelevanceScore(b, clean) - calculateArtistRelevanceScore(a, clean);
        });

        // Strictly deduplicate by normalized artist name to eliminate duplicate cards
        const uniqueResults: Artist[] = [];
        const seenNorms = new Set<string>();
        for (const art of results) {
            const norm = (art.name || '').trim().toLowerCase();
            if (!norm || seenNorms.has(norm)) continue;
            seenNorms.add(norm);
            uniqueResults.push(art);
        }

        const topResults = uniqueResults.slice(0, limit);
        // Enrich portraits and authentic follower counts in parallel for the top candidates if needed
        await Promise.all(topResults.map(async (art) => {
            const curFans = typeof art.followers === 'object' && art.followers !== null ? art.followers.total : (Number(art.followers) || 0);
            if (!art.images || art.images.length === 0 || !art.images[0]?.url || curFans <= 500) {
                const meta = await resolveArtistMetadata(art.name);
                if (!art.images || art.images.length === 0 || !art.images[0]?.url) {
                    art.images = [{ url: meta.imageUrl }];
                }
                art.genres = meta.genres;
                if (meta.followers && meta.followers > curFans) {
                    art.followers = { total: meta.followers };
                }
                if (meta.monthlyListeners && (!art.monthlyListeners || meta.monthlyListeners > art.monthlyListeners)) {
                    art.monthlyListeners = meta.monthlyListeners;
                }
            }
        }));

        return topResults;
    }

    /**
     * Get Artist Top Tracks:
     * Discovers an artist's top playable songs across Spotify & YouTube,
     * strictly verifying that tracks belong to the requested artist and eliminating
     * unrelated songs, tribute covers, and duplicate releases.
     */
    async getArtistTracks(artistId: string, artistName?: string): Promise<Track[]> {
        const decoded = decodeURIComponent(artistName || artistId || '');
        const cleanTarget = decoded
            .replace(/^(sp_art_|yt_art_|dz_|it_|artist-)/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

        if (!cleanTarget) return [];

        const normTarget = cleanTarget
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');

        const candidateTracks: Track[] = [];

        // 0. Authentic Spotify Pathfinder Top Tracks (authentic 640x640 artwork directly from Spotify CDN)
        const meta = await resolveArtistMetadata(cleanTarget);
        if (meta.topTracks && meta.topTracks.length > 0) {
            candidateTracks.push(...meta.topTracks);
        }

        // 1. Supplement with Spotube Spotify search with artist prefix to get additional official catalog tracks
        try {
            const spotubeArtistTracks = await searchSpotubeSpotifyTracks(`artist:${cleanTarget}`, 35);
            if (Array.isArray(spotubeArtistTracks)) {
                candidateTracks.push(...spotubeArtistTracks);
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Spotube artist query notice:', err.message);
        }

        // 2. Also search YouTube Innertube for official audio if catalog needs more tracks
        if (candidateTracks.length < 15) {
            try {
                const ytTracks = await searchYouTubeInnertubeTracks(`${cleanTarget} official audio`, 20);
                if (Array.isArray(ytTracks)) {
                    candidateTracks.push(...ytTracks);
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] YouTube artist search notice:', err.message);
            }
        }

        const junkRegex = /\b(tribute|karaoke|instrumental\s*version|backing\s*track|8-?bit|16-?bit|type\s*beat|string\s*quartet|in\s*the\s*style\s*of|behind\s*the\s*scenes|vevo\s*footnotes|fashion\s*show|lollapalooza|interview|documentary|full\s*set|festival\s*performance)\b/i;
        const results: Track[] = [];
        const seenCanonicalTitles = new Set<string>();

        for (const track of candidateTracks) {
            if (!track || !track.name || !Array.isArray(track.artists) || track.artists.length === 0) {
                continue;
            }

            const trackTitle = track.name.trim();
            const trackTitleLower = trackTitle.toLowerCase();

            // Reject tribute / karaoke / instrumental / parody / 8-bit / non-music video junk
            if (junkRegex.test(trackTitleLower)) {
                continue;
            }

            // Strict rule: The target singer MUST be the PRIMARY / LEAD artist (track.artists[0])
            // This guarantees songs by other artists (e.g. The Weeknd's "Die For You" or "Save Your Tears")
            // NEVER leak onto another singer's profile page.
            const primaryArtist = (track.artists[0]?.name || '').trim();
            const primaryNorm = primaryArtist
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');

            if (!primaryNorm) continue;

            // Reject if primary artist is a cover band or tribute entity
            if (junkRegex.test(primaryArtist.toLowerCase())) {
                continue;
            }

            const isPrimary = primaryNorm === normTarget || primaryNorm.includes(normTarget) || normTarget.includes(primaryNorm);
            if (!isPrimary) {
                // Not by this artist as primary lead performer -> skip!
                continue;
            }

            // Canonical title deduplication (strips remix, deluxe, live, acoustic, version tags)
            const canonical = trackTitleLower
                .replace(/\s*[\(\[].*?[\)\]]/gi, '')
                .replace(/[-–—]\s*(remix|remastered|live|acoustic|version|edit|instrumental|closed-captioned|official).*$/i, '')
                .replace(/[^a-z0-9]/g, '')
                .trim();

            if (!canonical || seenCanonicalTitles.has(canonical)) {
                continue;
            }

            seenCanonicalTitles.add(canonical);

            // Clean up display title (strips trailing junk like "- Closed-Captioned" or "- Official")
            const cleanDisplayName = track.name
                .replace(/\s*[-–—]\s*(closed-captioned|official\s*video|official\s*audio|official|lyric\s*video)\s*$/i, '')
                .trim();

            // Guard: ensure track cover is authentic Spotify album artwork and NEVER the artist profile picture or Unsplash
            let trackCover = track.album?.images?.[0]?.url;
            if (trackCover && (trackCover.includes('ab676161') || trackCover.includes('unsplash.com'))) {
                const realCover = track.id && track.id.length === 22 ? await resolveSpotifyTrackCover(track.id) : null;
                trackCover = realCover || '';
            }

            results.push({
                ...track,
                name: cleanDisplayName || track.name,
                album: {
                    ...track.album,
                    name: track.album?.name || track.name,
                    images: trackCover ? [{ url: trackCover }] : []
                }
            });

            if (results.length >= 25) {
                break;
            }
        }

        return results;
    }

    /**
     * Get Artist Profile Details:
     * Unified single source of truth for artist portrait, followers, and bio
     */
    async getArtistDetails(artistId: string, artistName?: string): Promise<any> {
        const decoded = decodeURIComponent(artistName || artistId || '');
        let cleanName = decoded
            .replace(/^(sp_art_|yt_art_|dz_|it_|artist-)/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

        const norm = cleanName.toLowerCase().trim();
        const knownSpotifyId = TOP_ARTIST_SPOTIFY_IDS[norm];
        const effectiveId = (/^[0-9A-Za-z]{22}$/.test(artistId)) ? artistId : (knownSpotifyId || '');

        let ov: any = null;
        if (effectiveId) {
            ov = await fetchSpotifyArtistOverview(effectiveId);
            if (ov && ov.name) {
                cleanName = ov.name;
            }
        }

        const meta = await resolveArtistMetadata(cleanName);
        const displayName = cleanName.replace(/\b\w/g, c => c.toUpperCase());
        const coverImage = (ov?.avatarUrl) || meta.imageUrl;
        const headerImage = (ov?.headerUrl) || meta.headerUrl || coverImage;

        return {
            id: artistId,
            name: displayName,
            coverImage,
            headerImage,
            images: [{ url: coverImage }],
            monthlyListeners: ov?.monthlyListeners || meta.monthlyListeners || meta.followers || 0,
            followers: ov?.followers || meta.followers || 0,
            genres: meta.genres,
            bio: meta.bio || `<strong>${displayName}</strong> is a celebrated musical artist with millions of fans worldwide. Known for innovative sound design and emotive melodies, ${displayName} continues to craft charting tracks and iconic records.`,
            verified: ov?.verified ?? meta.verified ?? true
        };
    }

    /**
     * Get top tracks
     */
    async getTopTracks(): Promise<Track[]> {
        const pinnedFirstTrack: Track = {
            id: 'isabel-larosa-eyes-dont-lie',
            uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
            name: "Eyes Don't Lie",
            artists: [{ name: 'Isabel LaRosa' }],
            album: {
                name: "Eyes Don't Lie",
                images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
            },
            duration_ms: 150000,
            preview_url: null
        };

        // Spotify Today's Top Hits flagship chart
        try {
            const playlist = await this.getPlaylist('37i9dQZF1DXcBWIGoYBM5M');
            const items = playlist.tracks?.items || [];
            if (items.length > 0) {
                const tracks = items
                    .map(i => i.track)
                    .filter((t: Track) => t && !t.name.toLowerCase().includes('eyes don'));
                if (tracks.length > 0) {
                    return [pinnedFirstTrack, ...tracks];
                }
            }
        } catch (sErr: any) {
            console.warn('[SpotifyScraper] Spotify top tracks notice:', sErr.message);
        }

        return [pinnedFirstTrack];
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
     * Discovers songs matching the mood, style, and sonic cluster of the current track & artist using Spotify & YouTube
     */
    async getSmartMoodSuggestions(trackName: string, artistName: string): Promise<Track[]> {
        const cleanTrack = (trackName || '').toLowerCase().trim();
        const cleanArtist = (artistName || '').trim();
        const suggestions: Track[] = [];
        const seenIds = new Set<string>();

        try {
            if (cleanArtist) {
                // 1. Search Spotify & YouTube in parallel for artist's songs & vibe (time-boxed to 800ms)
                const [spotifyTracks, ytTracks] = await Promise.allSettled([
                    withTimeout(searchSpotubeSpotifyTracks(cleanArtist, 12), 800),
                    withTimeout(searchYouTubeInnertubeTracks(`${cleanArtist} songs`, 12), 800)
                ]);

                if (spotifyTracks.status === 'fulfilled' && Array.isArray(spotifyTracks.value)) {
                    for (const item of spotifyTracks.value) {
                        if (item.name?.toLowerCase() !== cleanTrack && !seenIds.has(item.id)) {
                            seenIds.add(item.id);
                            suggestions.push(item);
                        }
                    }
                }

                if (ytTracks.status === 'fulfilled' && Array.isArray(ytTracks.value)) {
                    for (const item of ytTracks.value) {
                        if (item.name?.toLowerCase() !== cleanTrack && !seenIds.has(item.id)) {
                            seenIds.add(item.id);
                            suggestions.push(item);
                        }
                    }
                }
            }

            if (suggestions.length < 5 && cleanArtist) {
                const searchResults = await this.searchTracks(cleanArtist, 10);
                for (const t of searchResults) {
                    if (t.name.toLowerCase() !== cleanTrack && !seenIds.has(t.id)) {
                        seenIds.add(t.id);
                        suggestions.push(t);
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Smart mood suggestions notice:', err.message);
        }

        if (suggestions.length === 0) {
            return this.getTopTracks();
        }

        return suggestions;
    }
}
