import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const useKeyboardShortcuts = () => {
    const {
        isPlaying,
        setIsPlaying,
        skipForward,
        skipBack,
        isMuted,
        setIsMuted,
        volume,
        setVolume
    } = useStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault(); // Prevent scrolling
                    setIsPlaying(!isPlaying);
                    break;

                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        skipForward();
                    } else {
                        // Optional: Seek forward (requires access to audio ref, maybe later)
                        // For now, let's just use it for skip if modified, or maybe just skip?
                        // Spotify uses Ctrl+Right for skip. 
                        // Let's stick to standard media keys if possible, but for web:
                        skipForward();
                    }
                    break;

                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        skipBack();
                    } else {
                        skipBack();
                    }
                    break;

                case 'KeyM':
                    setIsMuted(!isMuted);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.1));
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.1));
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, setIsPlaying, skipForward, skipBack, isMuted, setIsMuted, volume, setVolume]);
};
