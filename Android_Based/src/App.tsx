import React, { useState, useEffect, useRef } from 'react';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistDetail from './pages/PlaylistDetail';
import Settings from './pages/Settings';
import Downloads from './pages/Downloads';
import { Preferences } from '@capacitor/preferences';
import { App as CapApp } from '@capacitor/app';
import { Home as HomeIcon, Search as SearchIcon, Library as LibraryIcon, Download, ChevronDown, Heart, SkipBack, SkipForward, Shuffle, Repeat, Play, Pause } from 'lucide-react';
import { SpotifyService } from './services/SpotifyService';
import { MusicService } from './services/MusicService';
import type { Track } from './types/types';
import { useDownloadManager } from './hooks/useDownloadManager';
import { usePlaybackState } from './hooks/usePlaybackState';
import { Loader2, Check } from 'lucide-react';

import { registerPlugin } from '@capacitor/core';
import NyxMusic from './plugins/NyxMusic';


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  // Player State (Native Source of Truth)
  const playbackState = usePlaybackState();

  // Local loading state only (native handles buffering but UI feedback is good)
  const [isLoading, setIsLoading] = useState(false);

  // Queue State
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Shuffle & Repeat State
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Download Manager
  const {
    downloads,
    isDownloaded,
    getDownloadProgress,
    downloadTrack,
    deleteDownload
  } = useDownloadManager();

  // --- 1. AUTH LOGIC ---
  useEffect(() => {
    const checkAuth = async () => {
      const { value } = await Preferences.get({ key: 'spotify_access_token' });
      if (value) setIsAuthenticated(true);
    };
    checkAuth();

    CapApp.addListener('appUrlOpen', async (data) => {
      if (data.url.includes('code=')) {
        const code = new URL(data.url).searchParams.get('code');
        if (code) exchangeCodeForToken(code);
      }
    });
  }, []);

  // Play next song
  const playNextSong = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      console.log('Queue ended');
      return;
    }
    const nextTrack = queue[nextIdx];
    setCurrentIndex(nextIdx);
    handlePlayTrack(nextTrack, queue);
  };

  // Play previous song
  const playPreviousSong = () => {
    const prevIdx = currentIndex - 1;
    if (prevIdx < 0) return;
    const prevTrack = queue[prevIdx];
    setCurrentIndex(prevIdx);
    handlePlayTrack(prevTrack, queue);
  };

  const exchangeCodeForToken = async (code: string) => {
    try {
      const data = await SpotifyService.exchangeCode(code);
      if (data.access_token) {
        await Preferences.set({ key: 'spotify_access_token', value: data.access_token });
        if (data.refresh_token) {
          await Preferences.set({ key: 'spotify_refresh_token', value: data.refresh_token });
        }
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error('Token exchange failed', e);
    }
  };

  // --- 2. PLAYBACK LOGIC (Native Plugin) ---
  const handlePlayTrack = async (track: Track, playQueue?: Track[]) => {
    setCurrentTrack(track);
    setIsLoading(true);

    if (playQueue && playQueue.length > 0) {
      setQueue(playQueue);
      const idx = playQueue.findIndex(t => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }

    try {
      // 1. Check for Offline Playback (Priority)
      if (track.uri && (track.uri.startsWith('file://') || track.uri.startsWith('/'))) {
        console.log('📂 Playing offline file:', track.uri);
        await NyxMusic.loadTrack({
          videoId: track.id,
          title: track.name,
          artist: track.artists[0]?.name || 'Unknown',
          localPath: track.uri,
          artwork: track.album.images[0]?.url
        });
        // State updates via event listener
        setIsLoading(false);
        return;
      }

      // 2. Search YouTube for this track using name + artist
      const searchQuery = `${track.name} ${track.artists[0]?.name || ''} audio`;
      console.log('Searching YouTube for:', searchQuery);

      const videoId = await MusicService.searchVideoId(searchQuery);

      if (!videoId) {
        console.error('No YouTube video found for:', searchQuery);
        setIsLoading(false);
        return;
      }

      console.log('Found YouTube video ID:', videoId);

      // Get direct stream URL from Invidious
      const streamUrl = await MusicService.getStreamUrl(videoId);

      if (streamUrl) {
        console.log('Playing native stream:', streamUrl);
        await NyxMusic.loadTrack({
          url: streamUrl,
          title: track.name,
          artist: track.artists[0]?.name || 'Unknown',
          artwork: track.album.images[0]?.url
        });
        // State updates via event listener
      } else {
        console.error('Failed to get stream URL for video:', videoId);
      }
    } catch (e) {
      console.error('Playback error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    await playbackState.togglePlay();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = x / width;

    // Duration is in MS, seekTo expects Seconds usually? 
    // Wait, usePlaybackState.seekTo expects Seconds.
    // playbackState.duration is MS.
    const newTimeMs = playbackState.duration * percentage;
    playbackState.seekTo(newTimeMs / 1000);
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  // Toggle repeat mode
  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const handlePlaylistSelect = (id: string) => {
    setSelectedPlaylistId(id);
    setActiveTab('playlist');
  };

  // Format time MM:SS
  const formatTime = (ms: number) => {
    if (!ms || isNaN(ms)) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 3. RENDER ACTIVE PAGE ---
  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <Settings onBack={() => setActiveTab('home')} />;
      case 'home':
        return <Home
          isAuthenticated={isAuthenticated}
          onPlaylistSelect={handlePlaylistSelect}
          onSettingsClick={() => setActiveTab('settings')}
          onSearch={() => setActiveTab('search')}
          onPlayTrack={handlePlayTrack}
        />;
      case 'search':
        return <Search
          isAuthenticated={isAuthenticated}
          onPlayTrack={(track, queue) => handlePlayTrack(track, queue)}
          onBack={() => setActiveTab('home')}
          showBack={false}
        />;
      case 'library':
        return <Library
          isAuthenticated={isAuthenticated}
          onPlaylistSelect={handlePlaylistSelect}
        />;
      case 'playlist':
        return selectedPlaylistId ? (
          <PlaylistDetail
            id={selectedPlaylistId}
            onBack={() => setActiveTab('home')}
            onPlayTrack={handlePlayTrack}
          />
        ) : null;
      case 'downloads':
        return <Downloads
          isAuthenticated={isAuthenticated}
          downloads={downloads}
          onPlayTrack={handlePlayTrack}
          onDelete={deleteDownload}
        />;
      default:
        return <Home
          isAuthenticated={isAuthenticated}
          onPlaylistSelect={handlePlaylistSelect}
          onSettingsClick={() => setActiveTab('settings')}
          onSearch={() => setActiveTab('search')}
          onPlayTrack={handlePlayTrack}
        />;
    }
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col">

      {/* NO AUDIO ELEMENT */}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </div>

      {/* Mini Player */}
      {currentTrack && !isPlayerExpanded && (
        <div className="mini-player fixed bottom-[4.5rem] left-2 right-2 h-14 bg-[#3E3E3E] rounded-md flex items-center px-2 justify-between shadow-lg z-50" onClick={() => setIsPlayerExpanded(true)}>
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <img src={currentTrack.album.images[0]?.url} className="w-10 h-10 rounded-sm object-cover" alt="" />
            <div className="flex flex-col min-w-0 ml-1">
              <span className="text-sm font-bold text-white truncate leading-tight">{currentTrack.name}</span>
              <span className="text-[11px] text-slate-300 truncate leading-tight">{currentTrack.artists[0].name}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3 mr-2">
            <button
              className="text-white active:scale-95 transition-transform"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            >
              {playbackState.isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* EXPANDED FULL-SCREEN PLAYER */}
      {currentTrack && isPlayerExpanded && (
        <div className="fixed inset-0 bg-gradient-to-b from-[#505050] to-[#121212] z-[100] flex flex-col h-[100dvh] px-6 pt-8 pb-8 animate-in slide-in-from-bottom duration-300">
          <header className="flex items-center justify-between h-16 mb-4">
            <button onClick={() => setIsPlayerExpanded(false)}>
              <ChevronDown size={32} className="text-white" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-80">PLAYING NOW</span>
              {queue.length > 0 && (
                <span className="text-[9px] text-slate-400">{currentIndex + 1} / {queue.length}</span>
              )}
            </div>
            <div className="w-8"></div>
          </header>

          <div className="flex-1 flex items-center justify-center mb-8 w-full">
            <div className="w-full aspect-square relative shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <img src={currentTrack.album.images[0]?.url} alt="" className="w-full h-full object-cover rounded-md" />
            </div>
          </div>

          <div className="flex justify-between items-end mb-6">
            <div className="flex flex-col min-w-0 pr-4">
              <h2 className="text-2xl font-bold text-white truncate leading-tight mb-1">{currentTrack.name}</h2>
              <p className="text-lg text-slate-300 truncate">{currentTrack.artists[0].name}</p>
            </div>
            <div className="flex items-center space-x-4 mb-1">
              {/* DOWNLOAD BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDownloaded(currentTrack.id)) {
                    deleteDownload(currentTrack.id);
                  } else {
                    downloadTrack(currentTrack);
                  }
                }}
              >
                {getDownloadProgress(currentTrack.id) !== undefined ? (
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={20} />
                    <span className="absolute text-[8px] font-bold">{getDownloadProgress(currentTrack.id)}%</span>
                  </div>
                ) : isDownloaded(currentTrack.id) ? (
                  <Check size={28} className="text-[#1ed760]" />
                ) : (
                  <Download size={28} className="text-white" />
                )}
              </button>

              <button>
                <Heart size={28} className="text-white" />
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {/* Clickable progress bar for seeking */}
            <div
              className="relative h-2 w-full bg-white/20 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="absolute h-full bg-white rounded-full transition-all"
                style={{ width: playbackState.duration > 0 ? `${(playbackState.position / playbackState.duration) * 100}%` : '0%' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"
                style={{ left: playbackState.duration > 0 ? `calc(${(playbackState.position / playbackState.duration) * 100}% - 6px)` : '0%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>{formatTime(playbackState.position)}</span>
              <span>{formatTime(playbackState.duration)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-8 px-2">
            <button onClick={toggleShuffle}>
              <Shuffle size={24} className={isShuffled ? 'text-[#1ed760]' : 'text-white'} />
            </button>
            <button onClick={playPreviousSong}><SkipBack size={36} className="text-white fill-white" /></button>
            <button
              className="w-16 h-16 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg text-black"
              onClick={togglePlay}
            >
              {playbackState.isPlaying ? (
                <Pause size={32} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>
            <button onClick={playNextSong}><SkipForward size={36} className="text-white fill-white" /></button>
            <button onClick={toggleRepeat} className="relative">
              <Repeat size={24} className={repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-white'} />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 text-[8px] font-bold text-[#1ed760]">1</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      {isAuthenticated && (
        <nav className="bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 border-t border-white/5 flex items-center justify-around px-4 z-40">
          <button onClick={() => setActiveTab('home')} className={`p-2 transition-colors ${activeTab === 'home' ? 'text-white' : 'text-slate-600'}`}>
            <HomeIcon size={26} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          </button>
          <button onClick={() => setActiveTab('search')} className={`p-2 transition-colors ${activeTab === 'search' ? 'text-white' : 'text-slate-600'}`}>
            <SearchIcon size={26} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          </button>
          <button onClick={() => setActiveTab('downloads')} className={`p-2 transition-colors ${activeTab === 'downloads' ? 'text-white' : 'text-slate-600'}`}>
            <Download size={26} strokeWidth={activeTab === 'downloads' ? 2.5 : 2} />
          </button>
          <button onClick={() => setActiveTab('library')} className={`p-2 transition-colors ${activeTab === 'library' ? 'text-white' : 'text-slate-600'}`}>
            <LibraryIcon size={26} className="rotate-90" strokeWidth={activeTab === 'library' ? 2.5 : 2} />
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
