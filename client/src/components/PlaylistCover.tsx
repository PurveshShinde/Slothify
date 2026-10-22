import React from 'react';
import { Music2 } from 'lucide-react';
import { Track } from '../types';

interface PlaylistCoverProps {
  images?: { url: string }[] | null;
  tracks?: { items?: { track?: Track }[]; total?: number } | null;
  className?: string;
  iconSize?: number;
  alt?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  images,
  tracks,
  className = '',
  iconSize = 24,
  alt = ''
}) => {
  // 1. Gather all unique album art URLs from tracks
  const trackArtworks: string[] = [];
  if (tracks?.items && tracks.items.length > 0) {
    for (const item of tracks.items) {
      const url = item.track?.album?.images?.[0]?.url;
      if (url && !trackArtworks.includes(url)) {
        trackArtworks.push(url);
      }
    }
    // If fewer than 4 unique artworks, fill with repeated track artworks
    if (trackArtworks.length < 4) {
      for (const item of tracks.items) {
        const url = item.track?.album?.images?.[0]?.url;
        if (url) trackArtworks.push(url);
        if (trackArtworks.length >= 4) break;
      }
    }
  }

  // 2. Filter any generic unsplash or picsum placeholder images
  const validImages = (images || [])
    .map(img => img?.url)
    .filter(url => url && !url.includes('picsum.photos') && !url.includes('images.unsplash.com')) as string[];

  // 3. Spotify 4-song collage:
  // Trigger when 4+ songs exist with art, or images has >= 4 items
  const collageList = trackArtworks.length >= 4
    ? trackArtworks.slice(0, 4)
    : (validImages.length >= 4 ? validImages.slice(0, 4) : []);

  if (collageList.length >= 4) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden select-none bg-[#181818] ${className}`}>
        {collageList.map((url, i) => (
          <img
            key={i}
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.opacity = '0.3';
            }}
          />
        ))}
      </div>
    );
  }

  // 4. 1 to 3 songs: Use the FIRST added song's icon/artwork!
  const firstSongArt = trackArtworks[0] || (validImages.length > 0 ? validImages[0] : null);
  if (firstSongArt) {
    return (
      <img
        src={firstSongArt}
        alt={alt}
        className={`w-full h-full object-cover select-none ${className}`}
        loading="lazy"
      />
    );
  }

  // 5. 0 songs / empty playlist: Spotify empty playlist placeholder (dark neutral with Music2 note icon)
  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#282828] text-[#b3b3b3] select-none ${className}`}>
      <Music2 size={iconSize} strokeWidth={1.75} className="opacity-80" />
    </div>
  );
};

export default PlaylistCover;

