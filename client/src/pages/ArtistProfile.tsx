import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  CheckCircle, 
  Heart, 
  Share2, 
  Clock, 
  Music2, 
  Plus, 
  AlertCircle 
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { Track } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface ArtistData {
  id: string;
  name: string;
  coverImage: string;
  images?: { url: string }[];
  monthlyListeners: number;
  followers?: number | { total: number };
  genres?: string[];
  bio?: string;
  verified?: boolean;
}

interface ArtistTrack extends Track {
  title?: string;
  thumbnail?: string;
  duration?: string;
  position?: number;
}

interface ArtistProfileProps {
  onPlayTrack?: (track: Track, queue: Track[]) => void;
  isPlaying?: boolean;
  onPlayPause?: (playing: boolean) => void;
  currentTrackId?: string;
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  isAuthenticated?: boolean;
  followedArtistIds?: Set<string>;
  onToggleFollow?: (artist: any) => void;
}

const swrFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Artist not found' : `Failed to load artist (${res.status})`);
  }
  return res.json();
};

export default function ArtistProfile({
  onPlayTrack,
  isPlaying,
  onPlayPause,
  currentTrackId,
  likedTrackIds,
  onToggleLike,
  isAuthenticated,
  followedArtistIds,
  onToggleFollow
}: ArtistProfileProps) {
  // 1. Extract the artist ID from the URL (/artist/:artistId)
  const { artistId } = useParams<{ artistId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOcean } = useTheme();

  const passedArtist = (location.state as any)?.artist;

  // 2. Security check: Block malformed IDs, dangerous injection payloads (XSS / SQLi)
  const isDangerous = !artistId || artistId.length > 150 || /[<>'"`\\;{}()|]/.test(artistId) || /(drop[\s\-_]+table|select\b|insert\b|delete\b|union\b|<script)/i.test(artistId);

  // 3. SWR Client-Side Data Caching: Instant UI load on return visits with stale-while-revalidate
  const profileKey = (!isDangerous && artistId) ? `/api/artists/${encodeURIComponent(artistId)}` : null;
  const tracksKey = (!isDangerous && artistId) ? `/api/artists/${encodeURIComponent(artistId)}/top-tracks` : null;

  const {
    data: swrProfile,
    error: profileError,
    isLoading: isProfileLoading
  } = useSWR<ArtistData>(profileKey, swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    fallbackData: passedArtist || undefined
  });

  const {
    data: swrTracks,
    error: tracksError,
    isLoading: isTracksLoading
  } = useSWR<ArtistTrack[]>(tracksKey, swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });

  const artist = swrProfile || passedArtist || null;
  const tracks = Array.isArray(swrTracks) ? swrTracks : [];
  const loading = isDangerous ? false : (!artist && isProfileLoading);
  const tracksLoading = isDangerous ? false : (tracks.length === 0 && isTracksLoading);
  const error = isDangerous ? "Invalid Artist ID" : (profileError ? profileError.message : null);

  const monthlyListenersCount = Number(artist?.monthlyListeners) || 0;
  const followersCount = typeof artist?.followers === 'object' && artist?.followers !== null
    ? Number((artist.followers as any).total) || 0
    : Number(artist?.followers) || 0;

  const [localIsFollowing, setLocalIsFollowing] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!artistId) return;
    try {
      const saved = localStorage.getItem('slothify_user_followed_artist_ids');
      if (saved) {
        const set = new Set(JSON.parse(saved));
        setLocalIsFollowing(set.has(artistId));
      }
    } catch (e) {}
  }, [artistId]);

  const isFollowing = (followedArtistIds && artistId)
    ? followedArtistIds.has(artistId)
    : localIsFollowing;

  const toggleFollow = () => {
    if (!artistId) return;
    if (onToggleFollow && artist) {
      onToggleFollow({
        id: artist.id,
        name: artist.name,
        images: artist.images || (artist.coverImage ? [{ url: artist.coverImage }] : []),
        followers: { total: followersCount || monthlyListenersCount || 0 },
        monthlyListeners: monthlyListenersCount
      });
      return;
    }

    setLocalIsFollowing(prev => {
      const next = !prev;
      try {
        const saved = localStorage.getItem('slothify_user_followed_artist_ids');
        const set = new Set(saved ? JSON.parse(saved) : []);
        if (next) set.add(artistId);
        else set.delete(artistId);
        localStorage.setItem('slothify_user_followed_artist_ids', JSON.stringify(Array.from(set)));
      } catch (e) {}
      return next;
    });
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0 && onPlayTrack) {
      onPlayTrack(tracks[0], tracks);
    }
  };

  // 4. UX OPTIMIZATION: Skeleton Loader (instead of simple "Loading...")
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse pb-24 max-w-7xl mx-auto">
        {/* Back Button Skeleton */}
        <div className="w-24 h-8 bg-white/5 rounded-xl" />

        {/* Header Hero Skeleton */}
        <div className="relative rounded-3xl p-6 md:p-10 bg-white/[0.03] border border-white/5 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
          <div className="w-36 h-36 md:w-52 md:h-52 rounded-full bg-white/10 flex-shrink-0" />
          <div className="space-y-4 flex-1 text-center md:text-left w-full">
            <div className="w-28 h-5 bg-white/10 rounded-full mx-auto md:mx-0" />
            <div className="w-3/4 md:w-1/2 h-10 md:h-14 bg-white/15 rounded-2xl mx-auto md:mx-0" />
            <div className="w-40 h-4 bg-white/10 rounded-md mx-auto md:mx-0" />
            <div className="flex justify-center md:justify-start gap-3 pt-2">
              <div className="w-32 h-11 bg-white/10 rounded-full" />
              <div className="w-28 h-11 bg-white/10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Tracks List Skeleton */}
        <div className="space-y-3 pt-4">
          <div className="w-32 h-6 bg-white/10 rounded-md mb-4" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <div className="w-6 h-4 bg-white/5 rounded" />
              <div className="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 bg-white/10 rounded" />
                <div className="w-1/4 h-3 bg-white/5 rounded" />
              </div>
              <div className="w-12 h-4 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State with Back to Search
  if (error || !artist) {
    return (
      <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-6 space-y-5 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl md:text-2xl font-bold text-white">Oops! {error || "Artist not found"}</h2>
          <p className="text-xs text-[#8a8489]">
            We could not find the artist profile you were looking for. Please try another search.
          </p>
        </div>
        <button
          onClick={() => navigate('/artists')}
          className={`px-6 py-2.5 rounded-full text-xs font-semibold text-white transition-all shadow-md active:scale-95 cursor-pointer ${
            isOcean 
              ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30' 
              : 'bg-[#c87d46] hover:bg-[#d97736] shadow-[#c87d46]/30'
          }`}
        >
          Back to Artists
        </button>
      </div>
    );
  }

  // 4. FRONTEND SECURITY: Sanitize bio HTML with DOMPurify to prevent XSS attacks
  const sanitizedBio = artist.bio ? DOMPurify.sanitize(artist.bio) : null;
  const isPlayingThisArtist = tracks.some(t => t.id === currentTrackId) && isPlaying;

  return (
    <div className="space-y-8 pb-0 max-w-7xl mx-auto">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/artists')}
          className="inline-flex items-center space-x-2 text-xs font-medium text-[#8a8489] hover:text-white transition-colors bg-white/[0.03] hover:bg-white/[0.08] px-3.5 py-2 rounded-xl border border-white/[0.06]"
        >
          <ArrowLeft size={16} />
          <span>Back to Artists</span>
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center space-x-1.5 text-xs text-[#8a8489] hover:text-white transition-colors bg-white/[0.03] hover:bg-white/[0.08] px-3.5 py-2 rounded-xl border border-white/[0.06]"
          title="Share Artist Link"
        >
          <Share2 size={15} />
          <span>{copiedShare ? 'Copied Link!' : 'Share'}</span>
        </button>
      </div>

      {/* Artist Profile Header Hero */}
      <div className={`relative rounded-3xl overflow-hidden p-6 md:p-10 border border-white/10 shadow-2xl backdrop-blur-xl transition-all ${
        isOcean 
          ? 'bg-gradient-to-br from-[#0c1d3f]/90 via-[#0a152d]/80 to-[#040e1a]/95' 
          : 'bg-gradient-to-br from-[#2a170f]/90 via-[#180f0a]/80 to-[#0f0704]/95'
      }`}>
        {/* Ambient Glow */}
        <div 
          className={`absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
          }`} 
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10">
          {/* Artist Portrait */}
          <div className="relative group w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/15 flex-shrink-0 bg-black/40">
            <img
              src={getOptimizedImageUrl(artist.coverImage || artist.images?.[0]?.url, '500') || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181824&color=f5d0b5&size=500&bold=true`}
              alt={artist.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181824&color=f5d0b5&size=500&bold=true`;
              }}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>

          {/* Profile Details */}
          <div className="flex-1 text-center md:text-left space-y-3 min-w-0">
            {/* Verified Badge */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
              <CheckCircle size={13} className="text-cyan-400 fill-cyan-400/20" />
              <span>Verified Artist</span>
            </div>

            {/* Name */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md truncate leading-tight">
              {artist.name}
            </h1>

            {/* Listeners & Followers & Genres */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-[#a39ea4]">
              {monthlyListenersCount > 0 && (
                <>
                  <span className="font-semibold text-white">
                    {monthlyListenersCount.toLocaleString()}
                  </span>
                  <span>monthly listeners</span>
                </>
              )}

              {followersCount > 0 && (
                <>
                  {monthlyListenersCount > 0 && <span>•</span>}
                  <span className="font-semibold text-white">
                    {followersCount.toLocaleString()}
                  </span>
                  <span>followers</span>
                </>
              )}

              {monthlyListenersCount === 0 && followersCount === 0 && (
                <span className="font-semibold text-white">Popular Artist</span>
              )}

              {artist.genres && artist.genres.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {artist.genres.slice(0, 3).map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] font-medium text-white/80">
                        {g}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
              {tracks.length > 0 && (
                <button
                  onClick={isPlayingThisArtist && onPlayPause ? () => onPlayPause(!isPlaying) : handlePlayAll}
                  className={`flex items-center space-x-2 px-6 py-3.5 rounded-full font-bold text-xs uppercase tracking-wider text-white shadow-xl transition-all active:scale-95 cursor-pointer ${
                    isOcean
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                      : 'bg-[#c87d46] hover:bg-[#d97736] shadow-[#c87d46]/30'
                  }`}
                >
                  {isPlayingThisArtist ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" className="ml-0.5" />}
                  <span>{isPlayingThisArtist ? 'Pause' : 'Play'}</span>
                </button>
              )}

              <button
                onClick={toggleFollow}
                className={`px-5 py-3.5 rounded-full font-semibold text-xs transition-all border cursor-pointer active:scale-95 ${
                  isFollowing
                    ? 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                    : 'bg-transparent hover:bg-white/5 text-white/90 border-white/30'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popular / Top Tracks Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">Popular</h2>
            {!tracksLoading && <span className="text-xs text-[#8a8489]">({tracks.length} tracks)</span>}
          </div>
        </div>

        {tracksLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-6 h-4 bg-white/5 rounded" />
                <div className="w-11 h-11 rounded-xl bg-white/10 flex-shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-4 bg-white/10 rounded animate-pulse" />
                  <div className="w-1/4 h-3 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="w-12 h-4 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-16 text-xs text-[#8a8489] bg-white/[0.02] rounded-2xl border border-white/[0.04]">
            No tracks found for this artist yet.
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, index) => {
              const isCurrent = track.id === currentTrackId;
              const isLiked = likedTrackIds?.has(track.id);
              const artistAvatar = artist.coverImage || artist.images?.[0]?.url;
              let rawThumb = track.thumbnail || track.album?.images?.[0]?.url;
              if (rawThumb && artistAvatar && (rawThumb === artistAvatar || rawThumb.includes('ab676161'))) {
                rawThumb = track.album?.images?.find(i => i.url && i.url !== artistAvatar && !i.url.includes('ab676161'))?.url || '';
              }
              const thumbUrl = getOptimizedImageUrl(rawThumb, '150') || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150';
              const displayTitle = track.title || track.name;
              const displayDuration = track.duration || '3:30';

              return (
                <div
                  key={track.id || index}
                  onClick={() => onPlayTrack && onPlayTrack(track, tracks)}
                  className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border ${
                    isCurrent
                      ? isOcean 
                        ? 'bg-blue-600/15 border-blue-500/30' 
                        : 'bg-[#c87d46]/15 border-[#c87d46]/30'
                      : 'bg-white/[0.015] hover:bg-white/[0.05] border-transparent hover:border-white/[0.06]'
                  }`}
                >
                  {/* Track Number / Play Indicator */}
                  <div className="w-6 text-center text-xs font-mono font-medium text-[#8a8489] flex-shrink-0">
                    <span className="group-hover:hidden">
                      {isCurrent && isPlaying ? (
                        <span className={`inline-block w-2 h-2 rounded-full animate-ping ${isOcean ? 'bg-cyan-400' : 'bg-[#f5d0b5]'}`} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="hidden group-hover:inline-block">
                      {isCurrent && isPlaying ? (
                        <Pause size={13} className="text-white mx-auto" />
                      ) : (
                        <Play size={13} fill="white" className="text-white mx-auto ml-0.5" />
                      )}
                    </span>
                  </div>

                  {/* Album Thumbnail (150px lazy-loaded) */}
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 shadow">
                    <img
                      src={thumbUrl}
                      loading="lazy"
                      alt={displayTitle}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Title & Artist */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs md:text-sm font-semibold truncate transition-colors leading-tight ${
                      isCurrent 
                        ? isOcean ? 'text-cyan-300' : 'text-[#f5d0b5]' 
                        : 'text-white group-hover:text-white'
                    }`}>
                      {displayTitle}
                    </h3>
                    <p className="text-[11px] text-[#8a8489] truncate mt-0.5 leading-tight">
                      {track.album?.name || track.artists?.map(a => a.name).join(', ') || artist.name}
                    </p>
                  </div>

                  {/* Actions & Duration */}
                  <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                    {onToggleLike && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(track);
                        }}
                        className={`p-1.5 rounded-full transition-colors ${
                          isLiked ? 'text-red-500' : 'text-[#8a8489] hover:text-white opacity-0 group-hover:opacity-100'
                        }`}
                        title={isLiked ? 'Unlike track' : 'Like track'}
                      >
                        <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                      </button>
                    )}

                    <span className="text-xs font-mono text-[#8a8489] w-10 text-right">
                      {displayDuration}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Artist Biography Card (Sanitized) - Cleanly anchored at the bottom with zero empty over-scroll */}
      {!tracksLoading && sanitizedBio && (
        <section className="rounded-3xl p-6 md:p-8 bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl space-y-3 mb-0">
          <h2 className="text-base font-bold text-white tracking-tight">About {artist.name}</h2>
          <div 
            className="text-xs sm:text-sm text-[#b8b3b9] leading-relaxed prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizedBio }}
          />
        </section>
      )}
    </div>
  );
}
