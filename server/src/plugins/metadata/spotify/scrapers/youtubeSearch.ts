import type { Track } from '../../../interfaces.js';

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

