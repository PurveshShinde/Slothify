import crypto from 'crypto';

/**
 * Decodes standard RFC 4648 Base32 strings into raw binary Buffers
 */
export function base32Decode(str: string): Buffer {
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

/**
 * Computes RFC 6238 Time-based One-Time Password for Spotube Spotify authentication
 */
export function generateSpotubeTOTP(secretBase32: string, timestampSeconds: number): string {
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

