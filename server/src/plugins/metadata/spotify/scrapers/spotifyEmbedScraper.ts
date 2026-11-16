const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

