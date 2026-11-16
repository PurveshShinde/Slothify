import axios from 'axios';
import { decodeHtmlEntities } from '../utils/htmlUtils.js';

export const FALLBACK_CURATED_ALBUMS = [
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

/**
 * Get authentic, real-time new releases and top chart albums from live public APIs
 */
export async function getNewReleases(): Promise<any[]> {
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
        albums.push(...FALLBACK_CURATED_ALBUMS);
    }

    return albums;
}

