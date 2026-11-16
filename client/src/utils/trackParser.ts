import { Track } from '../types';

export interface ExtendedTrack extends Track {
  added_at?: string;
  added_by?: { id: string; display_name?: string; [key: string]: any };
}

/**
 * Robust track array extractor for various playlist payload structures:
 * - Direct array of tracks: Track[]
 * - Standard playlist object: { tracks: Track[] }
 * - Spotify playlist envelope: { tracks: { items: [{ track: Track, added_at, added_by }] } }
 * - Paginated / items envelope: { items: [{ track: Track, ... }] | Track[] }
 *
 * Safely guards against null, undefined, and malformed elements without throwing.
 */
export const extractTracksArray = (data: any): ExtendedTrack[] => {
  if (!data) return [];
  if (Array.isArray(data.tracks)) return data.tracks.filter(Boolean);
  if (Array.isArray(data.tracks?.items)) {
    return data.tracks.items
      .filter((i: any) => i && (i.track || i.id))
      .map((i: any) => {
        const t = i.track || i;
        return { ...t, added_at: i.added_at, added_by: i.added_by };
      });
  }
  if (Array.isArray(data.items)) {
    return data.items
      .filter((i: any) => i && (i.track || i.id))
      .map((i: any) => {
        const t = i.track || i;
        return { ...t, added_at: i.added_at, added_by: i.added_by };
      });
  }
  if (Array.isArray(data)) return data.filter(Boolean);
  return [];
};

