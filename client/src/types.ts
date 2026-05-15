
export interface User {
  id: string;
  display_name: string;
  email?: string;
  images: { url: string }[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  owner: { display_name: string; id: string; images?: { url: string }[] };
  tracks: {
    total: number;
    items?: { track: Track }[];
  };
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

export interface Artist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
}

export interface Category {
  id: string;
  name: string;
  icons: { url: string }[];
}

export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
}
