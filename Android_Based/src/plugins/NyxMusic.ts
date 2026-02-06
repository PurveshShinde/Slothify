import { registerPlugin } from '@capacitor/core';

export interface DownloadEvent {
    type: 'start' | 'progress' | 'complete' | 'error' | 'update';
    videoId: string;
    progress?: number;
    error?: string;
}

export interface PlaybackState {
    isPlaying: boolean;
    position: number;
    duration: number;
    title: string;
    artist: string;
    videoId: string;
    artwork?: string;
}

export interface PlaybackStateEvent extends PlaybackState { }

export interface DownloadedItem {
    videoId: string;
    filePath: string;
    size: number;
    title?: string;
    artist?: string;
    thumbnail?: string;
    duration?: string;
    timestamp?: number;
}

export interface NyxMusicPlugin {
    // Playback
    loadTrack(options: {
        url?: string;
        videoId?: string;
        localPath?: string;
        title?: string;
        artist?: string;
        artwork?: string;
    }): Promise<void>;
    queueNext(options: {
        url: string;
        title?: string;
        artist?: string;
        artwork?: string;
    }): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    resumePlayback(): Promise<void>;
    pausePlayback(): Promise<void>;
    seekTo(options: { position: number }): Promise<void>;

    // Downloads
    downloadAudio(options: {
        videoId: string;
        title: string;
        artist: string;
        thumbnail?: string;
        duration?: string;
        isPlaylist?: boolean;
        playlistId?: string;
        playlistName?: string;
    }): Promise<void>;

    getDownloads(): Promise<{ singles: DownloadedItem[]; playlists: any[]; downloads?: DownloadedItem[] }>; // downloads optional for compat

    deleteDownload(options: { videoId: string }): Promise<void>;

    checkDownloadStatus(options: { videoId: string }): Promise<{ isDownloaded: boolean }>;

    addListener(eventName: 'downloadEvent', listenerFunc: (data: DownloadEvent) => void): Promise<PluginListenerHandle>;
    addListener(eventName: 'playbackState', listenerFunc: (data: PlaybackStateEvent) => void): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;

    // Search
    search(options: { query: string }): Promise<{ videoId: string | null }>;
}

export interface PluginListenerHandle {
    remove: () => Promise<void>;
}

const NyxMusic = registerPlugin<NyxMusicPlugin>('NyxMusic');

export default NyxMusic;
