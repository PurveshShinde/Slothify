
import React, { useState, useEffect } from 'react';
import { Playlist } from '../types';
import { Grid, List, Plus, Music2 } from 'lucide-react';
import axios from 'axios';

interface LibraryProps {
  isAuthenticated: boolean;
  onPlaylistSelect: (id: string) => void;
}

const Library: React.FC<LibraryProps> = ({ isAuthenticated, onPlaylistSelect }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      axios.get('/api/me/playlists')
        .then(res => setPlaylists(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <div className="p-6 bg-slate-900 rounded-full text-slate-600">
          <Music2 size={64} />
        </div>
        <h2 className="text-2xl font-bold text-white">Your library is empty</h2>
        <p className="text-slate-500">Login to see your playlists and saved music.</p>
        <button onClick={() => window.location.href = '/api/auth/login'} className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:scale-105 transition-transform">Login to Spotify</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Playlists</h1>
      </div>

      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-1 gap-1">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)
          ) : (
            playlists.length > 0 ? playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => onPlaylistSelect(playlist.id)}
                className="flex items-center space-x-4 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer group"
              >
                <img src={playlist.images[0]?.url || 'https://picsum.photos/200'} className="w-14 h-14 rounded-lg shadow-lg object-cover" alt={playlist.name} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate text-sm text-white group-hover:text-blue-400 transition-colors">{playlist.name}</h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">Playlist • {playlist.tracks.total} tracks</p>
                </div>
              </div>
            )) : (
              <p className="p-10 text-slate-500 italic text-center">No playlists found.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Library;
