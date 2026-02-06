import { useState, useEffect, useCallback } from 'react';
import NyxMusic, { DownloadedItem, DownloadEvent } from '../plugins/NyxMusic';

export const useDownloadManager = () => {
    const [downloads, setDownloads] = useState<DownloadedItem[]>([]);
    const [downloading, setDownloading] = useState<{ [key: string]: number }>({}); // videoId -> progress
    const [isLoaded, setIsLoaded] = useState(false);

    const loadDownloads = useCallback(async () => {
        try {
            const res = await NyxMusic.getDownloads();
            setDownloads(res.downloads || []);
            setIsLoaded(true);
        } catch (e) {
            console.error("Failed to load downloads", e);
        }
    }, []);

    useEffect(() => {
        loadDownloads();

        // Listen for events
        const listener = NyxMusic.addListener('downloadEvent', (data: DownloadEvent) => {
            console.log("Download Event:", data);
            const { type, videoId, progress } = data;

            if (type === 'start') {
                setDownloading(prev => ({ ...prev, [videoId]: 0 }));
            } else if (type === 'progress') {
                setDownloading(prev => ({ ...prev, [videoId]: progress || 0 }));
            } else if (type === 'complete') {
                setDownloading(prev => {
                    const next = { ...prev };
                    delete next[videoId];
                    return next;
                });
                loadDownloads(); // Refresh list
            } else if (type === 'error') {
                setDownloading(prev => {
                    const next = { ...prev };
                    delete next[videoId];
                    return next;
                });
                console.error(`Download failed for ${videoId}`);
            }
        });

        return () => {
            listener.then((handle: any) => handle.remove());
        };
    }, [loadDownloads]);

    const downloadTrack = async (track: any) => {
        try {
            setDownloading(prev => ({ ...prev, [track.id]: 0 })); // Optimistic start
            await NyxMusic.downloadAudio({
                videoId: track.id,
                title: track.name,
                artist: track.artists?.[0]?.name || "Unknown",
                thumbnail: track.album?.images?.[0]?.url || "",
                duration: track.duration_ms ? String(track.duration_ms) : "0"
            });
        } catch (e) {
            console.error("Download request failed", e);
            setDownloading(prev => {
                const next = { ...prev };
                delete next[track.id];
                return next;
            });
        }
    };

    const deleteDownload = async (videoId: string) => {
        try {
            await NyxMusic.deleteDownload({ videoId });
            setDownloads(prev => prev.filter(d => d.videoId !== videoId));
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const isDownloaded = (videoId: string) => {
        return downloads.some(d => d.videoId === videoId);
    };

    const getDownloadProgress = (videoId: string) => {
        return downloading[videoId];
    };

    return {
        downloads,
        downloading,
        isLoaded,
        downloadTrack,
        deleteDownload,
        isDownloaded,
        getDownloadProgress,
        refresh: loadDownloads
    };
};
