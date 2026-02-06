import { CapacitorHttp } from '@capacitor/core';

// YouTube API Key
const YOUTUBE_API_KEY = 'AIzaSyCBaWUqdbME8jJnvO9mfatvF2Owq5CoMqg';

export const AudioService = {
    // We only need the YouTube Video ID now, not a stream URL
    getYoutubeId: async (query: string): Promise<string | null> => {
        try {
            console.log(`Searching YouTube for: ${query}`);
            const searchRes = await CapacitorHttp.get({
                url: 'https://www.googleapis.com/youtube/v3/search',
                params: {
                    part: 'snippet',
                    maxResults: '1',
                    q: query,
                    type: 'video',
                    key: YOUTUBE_API_KEY
                }
            });

            if (searchRes.data.items && searchRes.data.items.length > 0) {
                const videoId = searchRes.data.items[0].id.videoId;
                console.log(`✅ Found Video ID: ${videoId}`);
                return videoId;
            }
        } catch (e) {
            console.error('YouTube Search Failed:', e);
        }
        return null;
    }
};
