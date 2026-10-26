import React, { useState, useEffect, useRef } from 'react';
import { Track, Playlist } from '../types';
import axios from 'axios';
import {
  Play, Pause, Heart, MoreHorizontal,
  Search, Bell, Sparkles, RefreshCw, ArrowDown, Settings,
  Music2, Compass, Radio, Shuffle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import VinylRecord from '../components/VinylRecord';
import AudioWaveform from '../components/AudioWaveform';

interface HomeProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  onPlayPause?: (playing: boolean) => void;
  onToggleLike?: (id: string, track?: Track) => void;
  likedTrackIds?: Set<string>;
  onOpenTurntable?: () => void;
}

export interface HeroShowcaseTrack extends Track {
  quote: string;
  stats: string;
}

// 5 Curated Hero Showcase Songs for Top Bar & Mobile Rotator
const FEATURED_HERO_TRACKS: HeroShowcaseTrack[] = [
  {
    id: 'isabel-larosa-eyes-dont-lie',
    uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
    name: "Eyes Don't Lie",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: "Eyes Don't Lie",
      images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
    },
    duration_ms: 150000,
    quote: "Every moment with you feels like the perfect song.",
    stats: "5.4M • Dark Pop • 2023"
  },
  {
    id: '3GWaFFi6TlPcZLYmCCHZ9O',
    uri: 'spotify:track:3GWaFFi6TlPcZLYmCCHZ9O',
    name: "Teenage Dream",
    artists: [{ name: 'Stephen Dawes' }],
    album: {
      name: "Teenage Dream",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273dfa368b8f51bb183328293bf' }]
    },
    duration_ms: 178000,
    quote: "We can dance until we die, looking for a teenage dream.",
    stats: "12.4M • Indie Bedroom Pop • 2022"
  },
  {
    id: '1YEc4P48PIWSPNip6FaI3T',
    uri: 'spotify:track:1YEc4P48PIWSPNip6FaI3T',
    name: "All That I Need",
    artists: [{ name: 'Matthew Ifield, Ebony Loren' }],
    album: {
      name: "All That I Need",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27339a64d1fd9073af02b085e2b' }]
    },
    duration_ms: 222000,
    quote: "You are all that I need, right here with you.",
    stats: "6.1M • Acoustic R&B Duet • 2023"
  },
  {
    id: '4yNk9iz9WVJikRFle3XEvn',
    uri: 'spotify:track:4yNk9iz9WVJikRFle3XEvn',
    name: "golden hour",
    artists: [{ name: 'JVKE' }],
    album: {
      name: "this is what ____ feels like",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730af4476af141051c728ee8b9' }]
    },
    duration_ms: 209000,
    quote: "It's your world, and I'm just living in it.",
    stats: "18.5M • Dream Pop • 2022"
  },
  {
    id: 'aditya-rikhari-sahiba',
    uri: 'spotify:track:aditya-rikhari-sahiba',
    name: "Sahiba",
    artists: [{ name: 'Aditya Rikhari' }],
    album: {
      name: "Sahiba",
      images: [{ url: 'https://c.saavncdn.com/140/Sahiba-Hindi-2023-20231213191015-500x500.jpg' }]
    },
    duration_ms: 198000,
    quote: "Dil ko tere bin kahin aaraam na mile.",
    stats: "8.2M • Soulful Indie • 2024"
  }
];

const DEFAULT_HERO_TRACK: Track = FEATURED_HERO_TRACKS[0];

// Rich Curated International Tracks (English Pop, Synth, Dark Pop, Alternative)
export const GUEST_INTERNATIONAL_TRACKS: Track[] = [
  {
    id: 'isabel-larosa-eyes-dont-lie',
    uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
    name: "Eyes Don't Lie",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: "Eyes Don't Lie",
      images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
    },
    duration_ms: 150000
  },
  {
    id: '3GWaFFi6TlPcZLYmCCHZ9O',
    uri: 'spotify:track:3GWaFFi6TlPcZLYmCCHZ9O',
    name: "Teenage Dream",
    artists: [{ name: 'Stephen Dawes' }],
    album: {
      name: "Teenage Dream",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273dfa368b8f51bb183328293bf' }]
    },
    duration_ms: 178000
  },
  {
    id: '1YEc4P48PIWSPNip6FaI3T',
    uri: 'spotify:track:1YEc4P48PIWSPNip6FaI3T',
    name: "All That I Need",
    artists: [{ name: 'Matthew Ifield, Ebony Loren' }],
    album: {
      name: "All That I Need",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27339a64d1fd9073af02b085e2b' }]
    },
    duration_ms: 222000
  },
  {
    id: '4yNk9iz9WVJikRFle3XEvn',
    uri: 'spotify:track:4yNk9iz9WVJikRFle3XEvn',
    name: "golden hour",
    artists: [{ name: 'JVKE' }],
    album: {
      name: "this is what ____ feels like",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730af4476af141051c728ee8b9' }]
    },
    duration_ms: 209000
  },
  {
    id: 'the-weeknd-blinding-lights',
    uri: 'spotify:track:the-weeknd-blinding-lights',
    name: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }],
    album: {
      name: 'After Hours',
      images: [{ url: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg' }]
    },
    duration_ms: 200000
  },
  {
    id: 'the-weeknd-starboy',
    uri: 'spotify:track:the-weeknd-starboy',
    name: 'Starboy',
    artists: [{ name: 'The Weeknd, Daft Punk' }],
    album: {
      name: 'Starboy',
      images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' }]
    },
    duration_ms: 230000
  },
  {
    id: 'billie-eilish-bad-guy',
    uri: 'spotify:track:billie-eilish-bad-guy',
    name: 'bad guy',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?',
      images: [{ url: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg' }]
    },
    duration_ms: 194000
  },
  {
    id: 'billie-eilish-everything-i-wanted',
    uri: 'spotify:track:billie-eilish-everything-i-wanted',
    name: 'everything i wanted',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'everything i wanted',
      images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600' }]
    },
    duration_ms: 245000
  },
  {
    id: 'isabel-larosa-favorite',
    uri: 'spotify:track:isabel-larosa-favorite',
    name: 'Favorite',
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: 'Favorite',
      images: [{ url: 'https://c.saavncdn.com/069/favorite-English-2024-20240319062315-500x500.jpg' }]
    },
    duration_ms: 134000
  },
  {
    id: 'isabel-larosa-im-yours',
    uri: 'spotify:track:isabel-larosa-im-yours',
    name: "i'm yours",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: "i'm yours",
      images: [{ url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600' }]
    },
    duration_ms: 154000
  },
  {
    id: 'dua-lipa-levitating',
    uri: 'spotify:track:dua-lipa-levitating',
    name: 'Levitating',
    artists: [{ name: 'Dua Lipa' }],
    album: {
      name: 'Future Nostalgia',
      images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600' }]
    },
    duration_ms: 203000
  },
  {
    id: 'harry-styles-as-it-was',
    uri: 'spotify:track:harry-styles-as-it-was',
    name: 'As It Was',
    artists: [{ name: 'Harry Styles' }],
    album: {
      name: "Harry's House",
      images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600' }]
    },
    duration_ms: 167000
  },
  {
    id: 'arctic-monkeys-do-i-wanna-know',
    uri: 'spotify:track:arctic-monkeys-do-i-wanna-know',
    name: 'Do I Wanna Know?',
    artists: [{ name: 'Arctic Monkeys' }],
    album: {
      name: 'AM',
      images: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600' }]
    },
    duration_ms: 272000
  },
  {
    id: 'post-malone-circles',
    uri: 'spotify:track:post-malone-circles',
    name: 'Circles',
    artists: [{ name: 'Post Malone' }],
    album: {
      name: "Hollywood's Bleeding",
      images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600' }]
    },
    duration_ms: 215000
  },
  {
    id: 'taylor-swift-cruel-summer',
    uri: 'spotify:track:taylor-swift-cruel-summer',
    name: 'Cruel Summer',
    artists: [{ name: 'Taylor Swift' }],
    album: {
      name: 'Lover',
      images: [{ url: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_500x500.jpg' }]
    },
    duration_ms: 178000
  },
  {
    id: 'adele-someone-like-you',
    uri: 'spotify:track:adele-someone-like-you',
    name: 'Someone Like You',
    artists: [{ name: 'Adele' }],
    album: {
      name: '21',
      images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600' }]
    },
    duration_ms: 285000
  },
  {
    id: 'coldplay-yellow',
    uri: 'spotify:track:coldplay-yellow',
    name: 'Yellow',
    artists: [{ name: 'Coldplay' }],
    album: {
      name: 'Parachutes',
      images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600' }]
    },
    duration_ms: 269000
  },
  {
    id: 'stephen-sanchez-until-i-found-you',
    uri: 'spotify:track:stephen-sanchez-until-i-found-you',
    name: 'Until I Found You',
    artists: [{ name: 'Stephen Sanchez' }],
    album: {
      name: 'Easy On My Eyes',
      images: [{ url: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=600' }]
    },
    duration_ms: 177000
  }
];

// Rich Curated Hindi Tracks (Bollywood, Indie Soul, Acoustic Romantic)
export const GUEST_HINDI_TRACKS: Track[] = [
  {
    id: 'aditya-rikhari-sahiba',
    uri: 'spotify:track:aditya-rikhari-sahiba',
    name: 'Sahiba',
    artists: [{ name: 'Aditya Rikhari' }],
    album: {
      name: 'Sahiba',
      images: [{ url: 'https://c.saavncdn.com/140/Sahiba-Hindi-2023-20231213191015-500x500.jpg' }]
    },
    duration_ms: 198000
  },
  {
    id: 'kesariya-arijit-singh',
    uri: 'spotify:track:kesariya-arijit-singh',
    name: 'Kesariya',
    artists: [{ name: 'Arijit Singh, Pritam' }],
    album: {
      name: 'Brahmastra',
      images: [{ url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg' }]
    },
    duration_ms: 268000
  },
  {
    id: 'husn-anuv-jain',
    uri: 'spotify:track:husn-anuv-jain',
    name: 'Husn',
    artists: [{ name: 'Anuv Jain' }],
    album: {
      name: 'Husn',
      images: [{ url: 'https://c.saavncdn.com/436/Husn-Hindi-2023-20231129054140-500x500.jpg' }]
    },
    duration_ms: 218000
  },
  {
    id: 'tum-se-hi-mohit-chauhan',
    uri: 'spotify:track:tum-se-hi-mohit-chauhan',
    name: 'Tum Se Hi',
    artists: [{ name: 'Mohit Chauhan, Pritam' }],
    album: {
      name: 'Jab We Met',
      images: [{ url: 'https://c.saavncdn.com/264/Jab-We-Met-Hindi-2007-20230524141618-500x500.jpg' }]
    },
    duration_ms: 321000
  },
  {
    id: 'tum-hi-ho-arijit-singh',
    uri: 'spotify:track:tum-hi-ho-arijit-singh',
    name: 'Tum Hi Ho',
    artists: [{ name: 'Arijit Singh, Mithoon' }],
    album: {
      name: 'Aashiqui 2',
      images: [{ url: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg' }]
    },
    duration_ms: 262000
  },
  {
    id: 'kun-faya-kun-rahman',
    uri: 'spotify:track:kun-faya-kun-rahman',
    name: 'Kun Faya Kun',
    artists: [{ name: 'A.R. Rahman, Mohit Chauhan, Javed Ali' }],
    album: {
      name: 'Rockstar',
      images: [{ url: 'https://c.saavncdn.com/512/Rockstar-Hindi-2011-20221212030045-500x500.jpg' }]
    },
    duration_ms: 473000
  },
  {
    id: 'zara-sa-kk',
    uri: 'spotify:track:zara-sa-kk',
    name: 'Zara Sa',
    artists: [{ name: 'KK, Pritam' }],
    album: {
      name: 'Jannat',
      images: [{ url: 'https://c.saavncdn.com/001/Jannat-Hindi-2008-20190629160352-500x500.jpg' }]
    },
    duration_ms: 303000
  },
  {
    id: 'labon-ko-kk',
    uri: 'spotify:track:labon-ko-kk',
    name: 'Labon Ko',
    artists: [{ name: 'KK, Pritam' }],
    album: {
      name: 'Bhool Bhulaiyaa',
      images: [{ url: 'https://c.saavncdn.com/393/Bhool-Bhulaiyaa-Hindi-2007-20221124113554-500x500.jpg' }]
    },
    duration_ms: 344000
  },
  {
    id: 'jeene-laga-hoon-atif',
    uri: 'spotify:track:jeene-laga-hoon-atif',
    name: 'Jeene Laga Hoon',
    artists: [{ name: 'Atif Aslam, Shreya Ghoshal' }],
    album: {
      name: 'Ramaiya Vastavaiya',
      images: [{ url: 'https://c.saavncdn.com/241/Ramaiya-Vastavaiya-Hindi-2013-20190617154526-500x500.jpg' }]
    },
    duration_ms: 237000
  },
  {
    id: 'tere-sang-yaara-atif',
    uri: 'spotify:track:tere-sang-yaara-atif',
    name: 'Tere Sang Yaara',
    artists: [{ name: 'Atif Aslam' }],
    album: {
      name: 'Rustom',
      images: [{ url: 'https://c.saavncdn.com/836/Rustom-Hindi-2018-20190709121650-500x500.jpg' }]
    },
    duration_ms: 290000
  },
  {
    id: 'maan-meri-jaan-king',
    uri: 'spotify:track:maan-meri-jaan-king',
    name: 'Maan Meri Jaan',
    artists: [{ name: 'King' }],
    album: {
      name: 'Champagne Talk',
      images: [{ url: 'https://c.saavncdn.com/734/Champagne-Talk-Hindi-2022-20221008011951-500x500.jpg' }]
    },
    duration_ms: 194000
  },
  {
    id: 'pehle-bhi-main-vishal',
    uri: 'spotify:track:pehle-bhi-main-vishal',
    name: 'Pehle Bhi Main',
    artists: [{ name: 'Vishal Mishra, Raj Shekhar' }],
    album: {
      name: 'ANIMAL',
      images: [{ url: 'https://c.saavncdn.com/649/ANIMAL-Hindi-2023-20231124191336-500x500.jpg' }]
    },
    duration_ms: 250000
  },
  {
    id: 'samjho-na-aditya-rikhari',
    uri: 'spotify:track:samjho-na-aditya-rikhari',
    name: 'Samjho Na',
    artists: [{ name: 'Aditya Rikhari' }],
    album: {
      name: 'Samjho Na',
      images: [{ url: 'https://c.saavncdn.com/artists/Aditya_Rikhari_001_20240227101823_500x500.jpg' }]
    },
    duration_ms: 185000
  },
  {
    id: 'baarishein-anuv-jain',
    uri: 'spotify:track:baarishein-anuv-jain',
    name: 'Baarishein',
    artists: [{ name: 'Anuv Jain' }],
    album: {
      name: 'Baarishein',
      images: [{ url: 'https://c.saavncdn.com/492/Baarishein-Hindi-2018-20210609075727-500x500.jpg' }]
    },
    duration_ms: 207000
  },
  {
    id: 'channa-mereya-arijit',
    uri: 'spotify:track:channa-mereya-arijit',
    name: 'Channa Mereya',
    artists: [{ name: 'Arijit Singh, Pritam' }],
    album: {
      name: 'Ae Dil Hai Mushkil',
      images: [{ url: 'https://c.saavncdn.com/244/Ae-Dil-Hai-Mushkil-Hindi-2016-500x500.jpg' }]
    },
    duration_ms: 289000
  },
  {
    id: 'raataan-lambiyan-jubin',
    uri: 'spotify:track:raataan-lambiyan-jubin',
    name: 'Raataan Lambiyan',
    artists: [{ name: 'Jubin Nautiyal, Asees Kaur' }],
    album: {
      name: 'Shershaah',
      images: [{ url: 'https://c.saavncdn.com/238/Shershaah-Original-Motion-Picture-Soundtrack-Hindi-2021-20210815181610-500x500.jpg' }]
    },
    duration_ms: 230000
  }
];

// Rich Curated Other Sort Tracks (Marathi Classics, Punjabi Hits, Latin)
export const GUEST_OTHER_TRACKS: Track[] = [
  {
    id: 'swapnil-galavar-khali',
    uri: 'spotify:track:swapnil-galavar-khali',
    name: 'Galavar Khali',
    artists: [{ name: 'Swapnil Bandodkar, Ajay-Atul' }],
    album: {
      name: 'Vedh',
      images: [{ url: 'https://c.saavncdn.com/038/Diwali-Pahat-Vaishali-Samant-Swapnil-Bandodkar-Marathi-2025-20251012010801-500x500.jpg' }]
    },
    duration_ms: 284000
  },
  {
    id: 'zingaat-ajay-atul',
    uri: 'spotify:track:zingaat-ajay-atul',
    name: 'Zingaat',
    artists: [{ name: 'Ajay-Atul' }],
    album: {
      name: 'Sairat',
      images: [{ url: 'https://c.saavncdn.com/229/Sairat-Marathi-2016-500x500.jpg' }]
    },
    duration_ms: 226000
  },
  {
    id: 'man-udhan-varyache',
    uri: 'spotify:track:man-udhan-varyache',
    name: 'Man Udhan Varyache',
    artists: [{ name: 'Ajay-Atul, Shankar Mahadevan' }],
    album: {
      name: 'Agga Bai Arechhaa',
      images: [{ url: 'https://c.saavncdn.com/409/Agga-Bai-Arechhaa-Marathi-2004-20210515124118-500x500.jpg' }]
    },
    duration_ms: 304000
  },
  {
    id: 'tauba-tauba-karan-aujla',
    uri: 'spotify:track:tauba-tauba-karan-aujla',
    name: 'Tauba Tauba',
    artists: [{ name: 'Karan Aujla' }],
    album: {
      name: 'Bad Newz',
      images: [{ url: 'https://c.saavncdn.com/992/Bad-Newz-Hindi-2024-20250730113701-500x500.jpg' }]
    },
    duration_ms: 206000
  },
  {
    id: 'softly-karan-aujla',
    uri: 'spotify:track:softly-karan-aujla',
    name: 'Softly',
    artists: [{ name: 'Karan Aujla, Ikky' }],
    album: {
      name: 'Making Memories',
      images: [{ url: 'https://c.saavncdn.com/401/Making-Memories-Punjabi-2023-20230818063004-500x500.jpg' }]
    },
    duration_ms: 154000
  },
  {
    id: 'diljit-lover',
    uri: 'spotify:track:diljit-lover',
    name: 'Lover',
    artists: [{ name: 'Diljit Dosanjh' }],
    album: {
      name: 'MoonChild Era',
      images: [{ url: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg' }]
    },
    duration_ms: 184000
  },
  {
    id: 'diljit-kinni-kinni',
    uri: 'spotify:track:diljit-kinni-kinni',
    name: 'Kinni Kinni',
    artists: [{ name: 'Diljit Dosanjh' }],
    album: {
      name: 'Ghost',
      images: [{ url: 'https://c.saavncdn.com/086/Ghost-Punjabi-2023-20230929054707-500x500.jpg' }]
    },
    duration_ms: 187000
  },
  {
    id: 'ap-dhillon-excuses',
    uri: 'spotify:track:ap-dhillon-excuses',
    name: 'Excuses',
    artists: [{ name: 'AP Dhillon, Gurinder Gill' }],
    album: {
      name: 'Excuses',
      images: [{ url: 'https://c.saavncdn.com/974/Excuses-Punjabi-2020-20201222030232-500x500.jpg' }]
    },
    duration_ms: 176000
  },
  {
    id: 'ap-dhillon-with-you',
    uri: 'spotify:track:ap-dhillon-with-you',
    name: 'With You',
    artists: [{ name: 'AP Dhillon' }],
    album: {
      name: 'With You',
      images: [{ url: 'https://c.saavncdn.com/832/With-You-Punjabi-2023-20230811063001-500x500.jpg' }]
    },
    duration_ms: 154000
  },
  {
    id: 'bad-bunny-titi-me-pregunto',
    uri: 'spotify:track:bad-bunny-titi-me-pregunto',
    name: 'Tití Me Preguntó',
    artists: [{ name: 'Bad Bunny' }],
    album: {
      name: 'Un Verano Sin Ti',
      images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600' }]
    },
    duration_ms: 243000
  }
];

// Helper: Fisher-Yates array shuffler
const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Generates a vibrant, balanced random mix from International, Hindi, and Other genres
const getRandomMix = (count: number): Track[] => {
  const intl = shuffleArray(GUEST_INTERNATIONAL_TRACKS);
  const hindi = shuffleArray(GUEST_HINDI_TRACKS);
  const other = shuffleArray(GUEST_OTHER_TRACKS);

  const pool: Track[] = [];
  const targetPerCategory = Math.ceil(count / 3);

  pool.push(...intl.slice(0, targetPerCategory));
  pool.push(...hindi.slice(0, targetPerCategory));
  pool.push(...other.slice(0, targetPerCategory));

  return shuffleArray(pool).slice(0, count);
};

// Curated dynamic guest mix themes
const GUEST_MIX_CARDS = [
  {
    id: 'hindi-soul-mix',
    name: 'Hindi Soul & Acoustic',
    subtitle: 'Arijit Singh, Anuv Jain, Aditya Rikhari',
    image: 'https://c.saavncdn.com/436/Husn-Hindi-2023-20231129054140-500x500.jpg',
    query: 'Hindi Acoustic Soul'
  },
  {
    id: 'global-dark-pop',
    name: 'Global Dark Pop & Synth',
    subtitle: 'Isabel LaRosa, The Weeknd, JVKE',
    image: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg',
    query: 'Dark Pop Hits'
  },
  {
    id: 'punjabi-regional-fire',
    name: 'Punjabi & Regional Beats',
    subtitle: 'Karan Aujla, Diljit, AP Dhillon',
    image: 'https://c.saavncdn.com/992/Bad-Newz-Hindi-2024-20250730113701-500x500.jpg',
    query: 'Punjabi Hits'
  },
  {
    id: 'marathi-classics',
    name: 'Marathi Melodies',
    subtitle: 'Ajay-Atul, Swapnil Bandodkar',
    image: 'https://c.saavncdn.com/038/Diwali-Pahat-Vaishali-Samant-Swapnil-Bandodkar-Marathi-2025-20251012010801-500x500.jpg',
    query: 'Marathi Classic Songs'
  },
  {
    id: 'international-lofi',
    name: 'International Chill & Indie',
    subtitle: 'Billie Eilish, Coldplay, Harry Styles',
    image: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600',
    query: 'Indie Pop Hits'
  }
];

// Generates complete fresh random guest feed across all sections
export const generateGuestFeed = () => ({
  popularTracks: getRandomMix(4),
  discoveryTracks: getRandomMix(5),
  freshReleases: getRandomMix(5),
  madeForYou: shuffleArray(GUEST_MIX_CARDS)
});

// Fallback arrays for authenticated initial state
const DEFAULT_POPULAR_TRACKS: Track[] = GUEST_INTERNATIONAL_TRACKS.slice(0, 4);
const DEFAULT_MADE_FOR_YOU = GUEST_MIX_CARDS;
const DEFAULT_RECENT_TRACKS: Track[] = GUEST_INTERNATIONAL_TRACKS.slice(0, 5);

export interface FeaturedArtistItem {
  name: string;
  role: string;
  listeners: string;
  avatar: string;
  query: string;
}

// Global / International Featured Artists
const GLOBAL_FEATURED_ARTISTS: FeaturedArtistItem[] = [
  {
    name: 'Isabel LaRosa',
    role: 'Dark Pop Visionary',
    listeners: '5.4M monthly',
    avatar: 'https://c.saavncdn.com/artists/Isabel_LaRosa_000_20240817082903_500x500.jpg',
    query: 'Isabel LaRosa'
  },
  {
    name: 'The Weeknd',
    role: 'Cinematic Synth & R&B',
    listeners: '108M monthly',
    avatar: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg',
    query: 'The Weeknd'
  },
  {
    name: 'Billie Eilish',
    role: 'Hypnotic Alternative',
    listeners: '75M monthly',
    avatar: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg',
    query: 'Billie Eilish'
  },
  {
    name: 'Taylor Swift',
    role: 'Acoustic & Pop Anthem',
    listeners: '112M monthly',
    avatar: 'https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_500x500.jpg',
    query: 'Taylor Swift'
  },
  {
    name: 'Aditya Rikhari',
    role: 'Indie Soul Ballads',
    listeners: '4.8M monthly',
    avatar: 'https://c.saavncdn.com/artists/Aditya_Rikhari_001_20240227101823_500x500.jpg',
    query: 'Aditya Rikhari'
  }
];

// India & South Asia Featured Artists (for listeners streaming from India)
const INDIA_FEATURED_ARTISTS: FeaturedArtistItem[] = [
  {
    name: 'Aditya Rikhari',
    role: 'Indie Soul Ballads',
    listeners: '4.8M monthly',
    avatar: 'https://c.saavncdn.com/artists/Aditya_Rikhari_001_20240227101823_500x500.jpg',
    query: 'Aditya Rikhari'
  },
  {
    name: 'Arijit Singh',
    role: 'Romantic Soul & Ballads',
    listeners: '42M monthly',
    avatar: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    query: 'Arijit Singh'
  },
  {
    name: 'Isabel LaRosa',
    role: 'Dark Pop Visionary',
    listeners: '5.4M monthly',
    avatar: 'https://c.saavncdn.com/artists/Isabel_LaRosa_000_20240817082903_500x500.jpg',
    query: 'Isabel LaRosa'
  },
  {
    name: 'Diljit Dosanjh',
    role: 'Global Punjabi Superstar',
    listeners: '22M monthly',
    avatar: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg',
    query: 'Diljit Dosanjh'
  },
  {
    name: 'Shreya Ghoshal',
    role: 'Melodic Classic & Bollywood',
    listeners: '35M monthly',
    avatar: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_500x500.jpg',
    query: 'Shreya Ghoshal'
  }
];

// Key Track Definitions with Verified 200 OK CDN Image URLs
const EYES_DONT_LIE_TRACK: Track = {
  id: 'isabel-larosa-eyes-dont-lie',
  uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
  name: "Eyes Don't Lie",
  artists: [{ name: 'Isabel LaRosa' }],
  album: {
    name: "Eyes Don't Lie",
    images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
  },
  duration_ms: 150000
};

const TEENAGE_DREAM_TRACK: Track = {
  id: '3GWaFFi6TlPcZLYmCCHZ9O',
  uri: 'spotify:track:3GWaFFi6TlPcZLYmCCHZ9O',
  name: "Teenage Dream",
  artists: [{ name: 'Stephen Dawes' }],
  album: {
    name: "Teenage Dream",
    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273dfa368b8f51bb183328293bf' }]
  },
  duration_ms: 178000
};

const ALL_THAT_I_NEED_TRACK: Track = {
  id: '1YEc4P48PIWSPNip6FaI3T',
  uri: 'spotify:track:1YEc4P48PIWSPNip6FaI3T',
  name: "All That I Need",
  artists: [{ name: 'Matthew Ifield, Ebony Loren' }],
  album: {
    name: "All That I Need",
    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27339a64d1fd9073af02b085e2b' }]
  },
  duration_ms: 222000
};

const GOLDEN_HOUR_TRACK: Track = {
  id: '4yNk9iz9WVJikRFle3XEvn',
  uri: 'spotify:track:4yNk9iz9WVJikRFle3XEvn',
  name: "golden hour",
  artists: [{ name: 'JVKE' }],
  album: {
    name: "this is what ____ feels like",
    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730af4476af141051c728ee8b9' }]
  },
  duration_ms: 209000
};

const SAHIBA_TRACK: Track = {
  id: 'aditya-rikhari-sahiba',
  uri: 'spotify:track:aditya-rikhari-sahiba',
  name: 'Sahiba',
  artists: [{ name: 'Aditya Rikhari' }],
  album: {
    name: 'Sahiba',
    images: [{ url: 'https://c.saavncdn.com/140/Sahiba-Hindi-2023-20231213191015-500x500.jpg' }]
  },
  duration_ms: 198000
};

const FAVORITE_TRACK: Track = {
  id: 'isabel-larosa-favorite',
  uri: 'spotify:track:isabel-larosa-favorite',
  name: 'Favorite',
  artists: [{ name: 'Isabel LaRosa' }],
  album: {
    name: 'Favorite',
    images: [{ url: 'https://c.saavncdn.com/069/favorite-English-2024-20240319062315-500x500.jpg' }]
  },
  duration_ms: 134000
};

const KESARIYA_TRACK: Track = {
  id: 'kesariya-arijit-singh',
  uri: 'spotify:track:kesariya-arijit-singh',
  name: 'Kesariya',
  artists: [{ name: 'Arijit Singh, Pritam' }],
  album: {
    name: 'Brahmastra',
    images: [{ url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg' }]
  },
  duration_ms: 268000
};

const HUSN_TRACK: Track = {
  id: 'husn-anuv-jain',
  uri: 'spotify:track:husn-anuv-jain',
  name: 'Husn',
  artists: [{ name: 'Anuv Jain' }],
  album: {
    name: 'Husn',
    images: [{ url: 'https://c.saavncdn.com/436/Husn-Hindi-2023-20231129054140-500x500.jpg' }]
  },
  duration_ms: 218000
};

const TAUBA_TAUBA_TRACK: Track = {
  id: 'tauba-tauba-karan-aujla',
  uri: 'spotify:track:tauba-tauba-karan-aujla',
  name: 'Tauba Tauba',
  artists: [{ name: 'Karan Aujla' }],
  album: {
    name: 'Bad Newz',
    images: [{ url: 'https://c.saavncdn.com/992/Bad-Newz-Hindi-2024-20250730113701-500x500.jpg' }]
  },
  duration_ms: 206000
};

const DO_RE_MI_TRACK: Track = {
  id: 'blackbear-do-re-mi',
  uri: 'spotify:track:blackbear-do-re-mi',
  name: 'do re mi',
  artists: [{ name: 'blackbear' }],
  album: {
    name: 'digital druglord',
    images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }]
  },
  duration_ms: 212000
};

const IM_YOURS_TRACK: Track = {
  id: 'isabel-larosa-im-yours',
  uri: 'spotify:track:isabel-larosa-im-yours',
  name: "i'm yours",
  artists: [{ name: 'Isabel LaRosa' }],
  album: {
    name: "i'm yours",
    images: [{ url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=500' }]
  },
  duration_ms: 154000
};

// Regional Fresh Releases (Preserves "Eyes Don't Lie" followed by requested playlist)
const INDIA_FRESH_RELEASES: Track[] = [
  EYES_DONT_LIE_TRACK,
  TEENAGE_DREAM_TRACK,
  ALL_THAT_I_NEED_TRACK,
  GOLDEN_HOUR_TRACK,
  SAHIBA_TRACK
];

const GLOBAL_FRESH_RELEASES: Track[] = [
  EYES_DONT_LIE_TRACK,
  TEENAGE_DREAM_TRACK,
  ALL_THAT_I_NEED_TRACK,
  GOLDEN_HOUR_TRACK,
  FAVORITE_TRACK
];

// Helper: detect streaming region from client timezone & locale
const detectUserRegion = (): { code: 'IN' | 'GLOBAL'; name: string } => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toLowerCase();
    const offset = new Date().getTimezoneOffset(); // -330 for IST (+05:30)

    const isIndia =
      tz.includes('Kolkata') ||
      tz.includes('Calcutta') ||
      tz.includes('India') ||
      offset === -330 ||
      lang.includes('-in') ||
      lang.startsWith('hi') ||
      lang.startsWith('mr') ||
      lang.startsWith('ta') ||
      lang.startsWith('te') ||
      lang.startsWith('bn') ||
      lang.startsWith('pa') ||
      lang.startsWith('gu');

    if (isIndia) {
      return { code: 'IN', name: 'India' };
    }
  } catch (e) {
    // fallback to India if local time zone shows +05:30 or error
  }
  return { code: 'GLOBAL', name: 'Global' };
};

// Resilient universal image fallback helper
const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback = 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500'
) => {
  const target = e.currentTarget;
  if (target.src !== fallback) {
    target.onerror = null;
    target.src = fallback;
  }
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const Home: React.FC<HomeProps> = ({
  isAuthenticated,
  onPlayTrack,
  currentTrack,
  isPlaying = false,
  onPlayPause,
  onToggleLike,
  likedTrackIds,
  onOpenTurntable
}) => {
  const navigate = useNavigate();
  const { cache, setHomeData, setRecommendations } = useCache();
  const { isOcean } = useTheme();

  // Search input state in top bar
  const [searchQuery, setSearchQuery] = useState('');

  // API State from cache or fresh
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(cache.homeData?.recentlyPlayed || []);
  const [topTracks, setTopTracks] = useState<Track[]>(cache.homeData?.topTracks || []);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>(cache.homeData?.featuredPlaylists || []);

  // Guest randomized feed state (International, Hindi, and Other sort songs)
  const [guestFeed, setGuestFeed] = useState(generateGuestFeed);

  // Authenticated recommendations state
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>(() => cache.recommendations || []);
  const [recommendationInfo, setRecommendationInfo] = useState<{ personalizedFor?: string; source?: string } | null>(() => cache.recommendationInfo || null);
  const [isLoadingPersonalized, setIsLoadingPersonalized] = useState<boolean>(() => Boolean(isAuthenticated && (!cache.recommendations || cache.recommendations.length === 0)));

  // Guard refs to prevent duplicate concurrent fetching (e.g., React 18 StrictMode or rapid re-renders)
  const isFetchingRef = useRef<boolean>(false);
  const hasFetchedRef = useRef<boolean>(false);

  // Randomizes all feed sections for guest listeners (International, Hindi, and Other sort)
  const randomizeGuestFeed = () => {
    setGuestFeed(generateGuestFeed());
  };

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAllData = async (isRefresh = false) => {
    // When NOT logged in: randomize guest feed with International, Hindi, and Other sort songs.
    if (!isAuthenticated) {
      randomizeGuestFeed();
      setIsRefreshing(false);
      setIsLoadingPersonalized(false);
      setPullMoveY(0);
      return;
    }

    // If already fetched in this session or cached (and not an explicit user pull-to-refresh), do NOT re-fetch!
    if (!isRefresh && (hasFetchedRef.current || (cache.recommendations && cache.recommendations.length > 0))) {
      if (recommendedTracks.length === 0 && cache.recommendations?.length) {
        setRecommendedTracks(cache.recommendations);
        if (cache.recommendationInfo) setRecommendationInfo(cache.recommendationInfo);
      }
      setIsLoadingPersonalized(false);
      return;
    }

    // Prevent concurrent duplicate requests from firing in parallel
    if (isFetchingRef.current && !isRefresh) {
      return;
    }
    isFetchingRef.current = true;

    try {
      if (recommendedTracks.length === 0 && (!cache.recommendations || cache.recommendations.length === 0)) {
        setIsLoadingPersonalized(true);
      }

      const [recentRes, featuredRes, topTracksRes, recRes] = await Promise.allSettled([
        axios.get('/api/me/recent'),
        axios.get('/api/featured-playlists'),
        axios.get('/api/me/top/tracks'),
        axios.get('/api/recommendations')
      ]);

      const newData: any = { ...cache.homeData };

      if (recentRes.status === 'fulfilled' && Array.isArray(recentRes.value.data) && recentRes.value.data.length > 0) {
        newData.recentlyPlayed = recentRes.value.data;
        setRecentlyPlayed(newData.recentlyPlayed);
      }
      if (featuredRes.status === 'fulfilled' && Array.isArray(featuredRes.value.data) && featuredRes.value.data.length > 0) {
        newData.featuredPlaylists = featuredRes.value.data;
        setFeaturedPlaylists(newData.featuredPlaylists);
      }
      if (topTracksRes.status === 'fulfilled' && Array.isArray(topTracksRes.value.data) && topTracksRes.value.data.length > 0) {
        newData.topTracks = topTracksRes.value.data;
        setTopTracks(newData.topTracks);
      }
      if (recRes.status === 'fulfilled' && recRes.value.data?.authenticated && Array.isArray(recRes.value.data.tracks)) {
        const info = {
          personalizedFor: recRes.value.data.personalizedFor,
          source: recRes.value.data.source
        };
        setRecommendedTracks(recRes.value.data.tracks);
        setRecommendationInfo(info);
        setRecommendations(recRes.value.data.tracks, info);
      }

      setHomeData(newData);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Failed to fetch home data', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingPersonalized(false);
      setIsRefreshing(false);
      setPullMoveY(0);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (recommendedTracks.length === 0 && (!cache.recommendations || cache.recommendations.length === 0)) {
        setIsLoadingPersonalized(true);
      }
      if (!hasFetchedRef.current) {
        fetchAllData();
      }
    } else {
      hasFetchedRef.current = false;
      setIsLoadingPersonalized(false);
      setRecommendedTracks([]);
      setRecommendationInfo(null);
      randomizeGuestFeed();
    }
  }, [isAuthenticated]);

  // Pull-to-Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && containerRef.current?.scrollTop === 0) {
      const diff = e.touches[0].clientY - pullStartY;
      if (diff > 0) setPullMoveY(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    if (pullMoveY > 70) {
      setIsRefreshing(true);
      fetchAllData(true);
    } else {
      setPullMoveY(0);
      setPullStartY(0);
    }
  };

  // Top Showcase 5 Songs Index
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Auto-advance songs on MOBILE ONLY (NOT on Windows/desktop view)
  useEffect(() => {
    const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobile()) return; // Moving songs for mobile only, not Windows/desktop view!

    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % FEATURED_HERO_TRACKS.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  // Lock hero song on Windows/desktop view (no song change in windows view, mobile only)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && featuredIndex !== 0) {
        setFeaturedIndex(0);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [featuredIndex]);

  const handlePrevHeroSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFeaturedIndex((prev) => (prev === 0 ? FEATURED_HERO_TRACKS.length - 1 : prev - 1));
  };

  const handleNextHeroSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFeaturedIndex((prev) => (prev + 1) % FEATURED_HERO_TRACKS.length);
  };

  // Touch swipe gesture handlers for mobile hero card with real-time gliding
  const [heroTouchStartX, setHeroTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    // Only allow swipe on mobile view (< 768px)
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
    setHeroTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
    setIsDragging(true);
  };

  const handleHeroTouchMove = (e: React.TouchEvent) => {
    if (heroTouchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - heroTouchStartX;
    // Damping resistance at ends
    if ((featuredIndex === 0 && diff > 0) || (featuredIndex === FEATURED_HERO_TRACKS.length - 1 && diff < 0)) {
      setTouchDeltaX(diff * 0.3);
    } else {
      setTouchDeltaX(diff);
    }
  };

  const handleHeroTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(touchDeltaX) > 45) {
      if (touchDeltaX < 0) {
        handleNextHeroSong();
      } else {
        handlePrevHeroSong();
      }
    }
    setTouchDeltaX(0);
    setHeroTouchStartX(null);
  };

  // Active showcase track from the 5 curated songs (on Windows view always index 0, on mobile rotates)
  const heroTrack: HeroShowcaseTrack = FEATURED_HERO_TRACKS[featuredIndex] || FEATURED_HERO_TRACKS[0];
  const isHeroLiked = heroTrack.id ? likedTrackIds?.has(heroTrack.id) : false;

  // Made for you cards:
  // When logged in: use API featured playlists or default reference cards
  // When NOT logged in: dynamic mix cards (Hindi Soul, Dark Pop, Punjabi Fire, Marathi Classics, etc.)
  const madeForYouCards = isAuthenticated
    ? DEFAULT_MADE_FOR_YOU.map((card, idx) => {
      if (featuredPlaylists[idx]) {
        return {
          id: featuredPlaylists[idx].id,
          name: featuredPlaylists[idx].name,
          subtitle: featuredPlaylists[idx].description || card.subtitle,
          image: featuredPlaylists[idx].images?.[0]?.url || card.image,
          query: featuredPlaylists[idx].name,
          isPlaylist: true
        };
      }
      return { ...card, isPlaylist: false };
    })
    : guestFeed.madeForYou.map(mix => ({
      id: mix.id,
      name: mix.name,
      subtitle: mix.subtitle,
      image: mix.image,
      query: mix.query,
      isPlaylist: false
    }));

  // Recently played tracks list:
  // When logged in: actual user listening history
  // When NOT logged in: random discovery songs (mix of International, Hindi, and Other sort)
  const recentTracksList: Track[] = isAuthenticated
    ? (recentlyPlayed.length >= 5
      ? recentlyPlayed.slice(0, 5)
      : [...recentlyPlayed, ...guestFeed.discoveryTracks.slice(recentlyPlayed.length, 5)])
    : guestFeed.discoveryTracks;

  // Popular tracks list:
  // When logged in: user's top tracks
  // When NOT logged in: random popular tracks (mix of International, Hindi, and Other sort)
  const popularTracksList: Track[] = isAuthenticated
    ? (topTracks.length >= 4
      ? topTracks.slice(0, 4)
      : [...topTracks, ...guestFeed.popularTracks.slice(topTracks.length, 4)])
    : guestFeed.popularTracks;

  // User streaming region state (default detected via timezone/locale, refined via fast IP lookup if guest)
  const [streamRegion, setStreamRegion] = useState<{ code: 'IN' | 'GLOBAL'; name: string }>(() => detectUserRegion());

  // Refine region dynamically via IP when not logged in
  useEffect(() => {
    if (isAuthenticated) return;
    let isMounted = true;
    fetch('https://api.country.is/', { signal: AbortSignal.timeout(2500) })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data?.country === 'IN') {
          setStreamRegion({ code: 'IN', name: 'India' });
        } else if (data?.country) {
          setStreamRegion({ code: 'GLOBAL', name: 'Global' });
        }
      })
      .catch(() => {
        // Silently preserve timezone-based detection on network timeout or offline
      });
    return () => { isMounted = false; };
  }, [isAuthenticated]);

  // Featured artists & fresh releases:
  // When logged in: region-tailored drops
  // When NOT logged in: random fresh releases (mix of International, Hindi, and Other sort)
  const activeFeaturedArtists = streamRegion.code === 'IN' ? INDIA_FEATURED_ARTISTS : GLOBAL_FEATURED_ARTISTS;
  const activeFreshReleases = streamRegion.code === 'IN' ? INDIA_FRESH_RELEASES : GLOBAL_FRESH_RELEASES;

  return (
    <div
      ref={containerRef}
      className="space-y-6 md:space-y-7 animate-in fade-in duration-500 select-none pb-14 text-white"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
      <div
        className="flex justify-center items-center pointer-events-none transition-all duration-300 -mt-2"
        style={{ height: pullMoveY > 0 ? `${pullMoveY}px` : '0px', opacity: pullMoveY > 0 ? 1 : 0 }}
      >
        <div className="bg-[#1c1922]/80 border border-white/10 p-2 rounded-full shadow-lg backdrop-blur-md">
          {isRefreshing ? (
            <RefreshCw className={`animate-spin ${isOcean ? 'text-cyan-400' : 'text-[#f5d0b5]'}`} size={20} />
          ) : (
            <ArrowDown className={`text-white transition-transform duration-200 ${pullMoveY > 70 ? (isOcean ? 'rotate-180 text-cyan-400' : 'rotate-180 text-[#f5d0b5]') : ''}`} size={20} />
          )}
        </div>
      </div>

      {/* 1. TOP BAR: Center Pill Search and Actions */}
      <div className="flex items-center justify-between gap-3 md:gap-4 select-none">
        {/* Pill Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-slate-400">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Search songs, artists, playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            className="w-full bg-black/25 hover:bg-black/35 focus:bg-black/50 text-xs text-white placeholder-slate-400 pl-9 pr-4 py-2 rounded-full border border-white/10 outline-none transition-all backdrop-blur-xl shadow-inner focus:border-white/25"
          />
        </div>

        {/* Action Icons */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <button
            onClick={() => { }}
            className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/45 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-xl shadow-sm"
            title="Notifications"
          >
            <Bell size={15} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/45 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-xl shadow-sm"
            title="Settings & Audio Engine"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 2. FEATURED HERO SHOWCASE CARD (FROSTED GLASS, AUTO-MOVING ON MOBILE, SMOOTH GLIDING CAROUSEL) */}
      <div
        onClick={() => {
          if (Math.abs(touchDeltaX) > 10) return;
          if (onOpenTurntable) onOpenTurntable();
        }}
        onTouchStart={handleHeroTouchStart}
        onTouchMove={handleHeroTouchMove}
        onTouchEnd={handleHeroTouchEnd}
        className="relative w-full rounded-[32px] p-6 sm:p-8 md:p-9 lg:p-10 overflow-hidden shadow-2xl flex flex-col justify-between cursor-pointer group transition-all duration-300 backdrop-blur-2xl bg-black/25 hover:bg-black/35 border border-white/10 hover:border-white/20 shadow-black/70"
        title="Click to open Fullscreen Vintage Turntable"
      >
        {/* Subtle ambient glow reactive to active theme */}
        <div
          className={`absolute -top-24 left-1/3 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${isOcean ? 'bg-cyan-500/[0.08]' : 'bg-[#eab690]/[0.04]'
            }`}
        />

        {/* LEFT & CENTER: Sliding Gliding Carousel Container (Strictly bounded so next song cannot peek) */}
        <div className="flex-1 min-w-0 w-full md:max-w-[calc(100%-14rem)] lg:max-w-[calc(100%-16rem)] overflow-hidden relative">
          <div
            className="w-full flex items-center will-change-transform"
            style={{
              transform: `translateX(calc(-${featuredIndex * 100}% + ${touchDeltaX}px))`,
              transition: isDragging ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {FEATURED_HERO_TRACKS.map((track, idx) => {
              const isSameTrack = Boolean(currentTrack) && (
                currentTrack?.id === track.id ||
                (Boolean(currentTrack?.name && track.name) &&
                  currentTrack?.name.toLowerCase() === track.name.toLowerCase() &&
                  currentTrack?.artists?.[0]?.name?.toLowerCase() === track.artists?.[0]?.name?.toLowerCase())
              );
              const isTrackPlaying = Boolean(isPlaying && isSameTrack);
              const isTrackLiked = track.id ? likedTrackIds?.has(track.id) : false;
              const isVisibleSlide = isDragging || touchDeltaX !== 0 || idx === featuredIndex;

              return (
                <div
                  key={track.id || idx}
                  className={`w-full min-w-full flex-shrink-0 flex flex-col sm:flex-row items-center gap-6 md:gap-8 select-none transition-opacity duration-300 ${isVisibleSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                  {/* Left: Square Album Artwork */}
                  <div className="flex-shrink-0 w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 relative rounded-2xl overflow-hidden shadow-2xl shadow-black/90 ring-1 ring-white/10 group-hover:scale-[1.01] transition-transform duration-500">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600'}
                      alt={track.name}
                      onError={(e) => handleImageError(e)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>

                  {/* Center: Track Details & Action Buttons matching reference */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center items-center sm:items-start text-center sm:text-left z-10">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[11px] font-semibold tracking-[0.28em] uppercase transition-colors duration-500 ${isOcean ? 'text-cyan-400' : 'text-[#a8907e]'
                          }`}
                      >
                        NOW PLAYING
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 tracking-wider uppercase border border-blue-500/30">
                        FULLSCREEN PLAYER
                      </span>
                    </div>

                    {/* Reference Serif Display Title */}
                    <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal text-[#faf6f0] tracking-tight leading-none mt-2.5 truncate max-w-full group-hover:text-white transition-colors">
                      {track.name}
                    </h1>

                    {/* Reference Italic Artist */}
                    <p
                      className={`font-serif italic text-lg sm:text-xl md:text-2xl mt-2 truncate max-w-full font-light transition-colors duration-500 ${isOcean ? 'text-cyan-100/90' : 'text-[#d4c6b8]'
                        }`}
                    >
                      {track.artists?.map(a => a.name).join(', ') || 'Artist'}
                    </p>

                    {/* Reference Stats Line */}
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-3 font-light">
                      <Heart size={13} className="text-slate-400" />
                      <span>{track.stats}</span>
                    </div>

                    {/* Reference Subtitle Quote */}
                    <p className="text-xs text-slate-400 mt-2 max-w-md line-clamp-1 italic font-light">
                      {track.quote}
                    </p>

                    {/* Reference Action Buttons: Play Pill, Heart Circle, More Circle */}
                    <div className="flex items-center space-x-3.5 mt-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSameTrack && onPlayPause) {
                            onPlayPause(!isPlaying);
                          } else {
                            onPlayTrack(track);
                          }
                        }}
                        className={`px-7 py-2.5 rounded-full font-semibold text-xs md:text-sm flex items-center space-x-2 active:scale-95 transition-colors duration-200 text-slate-950 shadow-md ${isOcean
                            ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/20'
                            : 'bg-[#eab690] hover:bg-[#f3cbb0] shadow-[#eab690]/20'
                          }`}
                      >
                        {isTrackPlaying ? (
                          <>
                            <Pause size={15} fill="currentColor" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} fill="currentColor" className="ml-0.5" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleLike && track.id) {
                            onToggleLike(track.id, track);
                          }
                        }}
                        className="w-10 h-10 rounded-full border border-white/15 hover:border-white/30 text-slate-300 hover:text-white flex items-center justify-center transition-colors bg-white/[0.04] hover:bg-white/[0.08]"
                        title="Save to Liked Songs"
                      >
                        <Heart
                          size={16}
                          className={
                            isTrackLiked
                              ? isOcean
                                ? 'fill-cyan-400 text-cyan-400'
                                : 'fill-[#eab690] text-[#eab690]'
                              : ''
                          }
                        />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/search?q=${encodeURIComponent(track.name)}`);
                        }}
                        className="w-10 h-10 rounded-full border border-white/15 hover:border-white/30 text-slate-300 hover:text-white flex items-center justify-center transition-colors bg-white/[0.04] hover:bg-white/[0.08]"
                        title="More Options"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Moving Songs Pagination Dots */}
          <div className="flex md:hidden items-center justify-center space-x-1.5 mt-5 z-20">
            {FEATURED_HERO_TRACKS.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setFeaturedIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-500 ${featuredIndex === i
                    ? isOcean
                      ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                      : 'w-6 bg-[#eab690] shadow-[0_0_8px_rgba(234,182,144,0.7)]'
                    : 'w-1.5 bg-white/20'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Right: Whole Uncropped Vinyl Disc with Song Poster, right above the music lines */}
        <div className="hidden md:flex flex-col items-center justify-center absolute right-8 md:right-10 lg:right-12 top-1/2 -translate-y-1/2 z-20 space-y-2 pointer-events-auto">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenTurntable) onOpenTurntable();
            }}
            className="w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 cursor-pointer select-none active:scale-95"
            title="Click to open Fullscreen Vintage Turntable"
          >
            <VinylRecord
              image={heroTrack.album?.images?.[0]?.url}
              isPlaying={isPlaying}
              className="w-full h-full"
            />
          </div>

          {/* Music lines directly below the whole disc */}
          <div className="pointer-events-none flex justify-center w-full">
            <AudioWaveform isPlaying={isPlaying} barCount={26} color={isOcean ? 'cyan' : 'amber'} className="h-3.5" />
          </div>
        </div>
      </div>

      {/* GUEST BANNER: Explains random songs and prompts sign-in for personalized recommendation system */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-black/40 border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 ${isOcean ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#eab690]/20 text-[#eab690]'}`}>
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white leading-tight">
                  Guest Mode: Shuffled Songs Active
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Random Mix
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-light leading-snug">
                Enjoy random International, Hindi, and regional tracks. Log in to activate the personalized recommendation engine based on your listening history and likes.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={randomizeGuestFeed}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-1.5 active:scale-95"
              title="Shuffle all songs on the home feed"
            >
              <Shuffle size={13} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
              <span>Shuffle</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-md ${isOcean
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                  : 'bg-[#eab690] hover:bg-[#f3cbb0] text-slate-950'
                }`}
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* 3. "MADE FOR YOU" / "RECOMMENDED FOR YOU" SECTION */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
              {isAuthenticated ? 'Recommended for you' : 'Made for you'}
            </h2>
            {isLoadingPersonalized || (isAuthenticated && recommendedTracks.length === 0) ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300 animate-pulse">
                <Sparkles size={11} className="text-cyan-400 animate-spin" />
                <span>Tailoring your music...</span>
              </span>
            ) : isAuthenticated && recommendedTracks.length > 0 ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300">
                <Sparkles size={11} className="text-cyan-400" />
                <span>{recommendationInfo?.personalizedFor ? `Based on ${recommendationInfo.personalizedFor}` : 'Tailored Recommendations'}</span>
              </span>
            ) : !isAuthenticated ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 hidden sm:inline-block">
                Random Mixes • International & Hindi
              </span>
            ) : null}
          </div>

          <div className="flex items-center space-x-2">
            {!isAuthenticated && (
              <button
                onClick={randomizeGuestFeed}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-slate-300 hover:text-white transition-all border border-white/10 active:scale-95 cursor-pointer"
                title="Shuffle feed"
              >
                <Shuffle size={12} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
                <span>Shuffle Feed</span>
              </button>
            )}
            <button
              onClick={() => navigate(isAuthenticated ? '/library' : '/search')}
              className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
            >
              See all
            </button>
          </div>
        </div>

        {/* Content: Skeleton when loading personalized, songs when loaded, or made-for-you when guest */}
        {isLoadingPersonalized || (isAuthenticated && recommendedTracks.length === 0) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 animate-in fade-in duration-200">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`rec-skeleton-${idx}`}
                className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/30 border border-white/[0.08] backdrop-blur-xl p-3 flex flex-col justify-end"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                <div className="h-3.5 bg-white/[0.08] rounded-full w-3/4 mb-1.5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
                <div className="h-2.5 bg-white/[0.04] rounded-full w-1/2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : isAuthenticated && recommendedTracks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {recommendedTracks.slice(0, 5).map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => onPlayTrack(track, recommendedTracks)}
                className="group relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/25 border border-white/[0.08] cursor-pointer hover:border-white/20 transition-all shadow-md select-none backdrop-blur-xl"
              >
                <img
                  src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500'}
                  alt={track.name}
                  onError={(e) => handleImageError(e)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-10">
                  <h3 className="font-semibold text-xs md:text-sm text-white truncate leading-tight">
                    {track.name}
                  </h3>
                  <p className="text-[10px] md:text-[11px] text-[#c4beb6] truncate mt-0.5 leading-tight font-light">
                    {track.artists?.[0]?.name || 'Artist'}
                  </p>
                </div>
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {madeForYouCards.map((card, idx) => (
              <div
                key={card.id || idx}
                onClick={() => {
                  if (card.isPlaylist) {
                    navigate(`/playlist/${card.id}`);
                  } else {
                    navigate(`/search?q=${encodeURIComponent(card.query || card.name)}`);
                  }
                }}
                className="group relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/25 border border-white/[0.08] cursor-pointer hover:border-white/20 transition-all shadow-md select-none backdrop-blur-xl"
              >
                <img
                  src={card.image}
                  alt={card.name}
                  onError={(e) => handleImageError(e)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-10">
                  <h3 className="font-semibold text-xs md:text-sm text-white truncate leading-tight">
                    {card.name}
                  </h3>
                  <p className="text-[10px] md:text-[11px] text-[#c4beb6] truncate mt-0.5 leading-tight font-light">
                    {card.subtitle}
                  </p>
                </div>
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. BOTTOM SPLIT: "Recently played" / "Random Discoveries" (Left) + "Popular tracks" (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 md:gap-8 pt-1">
        {/* Left Column: Recently played / Random Discoveries (approx 60% on desktop) */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                {isAuthenticated ? 'Recently played' : 'Random Discoveries'}
              </h2>
              {isLoadingPersonalized || (isAuthenticated && recentlyPlayed.length === 0) ? (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
                  Syncing history...
                </span>
              ) : !isAuthenticated && (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 hidden sm:inline-block">
                  International & Hindi Mix
                </span>
              )}
            </div>
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/history')}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
              >
                See all
              </button>
            ) : (
              <button
                onClick={randomizeGuestFeed}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors flex items-center space-x-1"
                title="Shuffle songs"
              >
                <Shuffle size={11} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
                <span>Shuffle</span>
              </button>
            )}
          </div>

          {isLoadingPersonalized || (isAuthenticated && recentlyPlayed.length === 0) ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3.5 animate-in fade-in duration-200">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`recent-skeleton-${idx}`} className="flex flex-col space-y-2">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/30 border border-white/[0.08]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                  <div className="h-3.5 bg-white/[0.08] rounded-full w-3/4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                  <div className="h-2.5 bg-white/[0.04] rounded-full w-1/2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3.5">
              {recentTracksList.map((track, idx) => (
                <div
                  key={track.id || idx}
                  onClick={() => onPlayTrack(track, recentTracksList)}
                  className="group flex flex-col space-y-2 cursor-pointer select-none"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/30 border border-white/[0.08] shadow-md shadow-black/50">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400'}
                      alt={track.name}
                      onError={(e) => handleImageError(e)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover Floating Play Button */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform duration-200">
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="px-0.5">
                    <h3 className="font-medium text-xs text-white truncate leading-tight group-hover:text-[#e6c8a2] transition-colors">
                      {track.name}
                    </h3>
                    <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                      {track.artists?.[0]?.name || 'Artist'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Popular tracks (approx 40% on desktop) */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Popular tracks</h2>
              {isLoadingPersonalized || (isAuthenticated && topTracks.length === 0) ? (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
                  Loading top hits...
                </span>
              ) : !isAuthenticated && (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  Shuffled
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/search')}
              className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
            >
              See all
            </button>
          </div>

          {isLoadingPersonalized || (isAuthenticated && topTracks.length === 0) ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`pop-skeleton-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-5 h-3 bg-white/[0.05] rounded-full" />
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] relative overflow-hidden flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3 bg-white/[0.08] rounded-full w-2/3 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                      </div>
                      <div className="h-2.5 bg-white/[0.04] rounded-full w-1/3 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-3 bg-white/[0.04] rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {popularTracksList.slice(0, 4).map((track, idx) => {
                const isTrackLiked = likedTrackIds?.has(track.id);
                const isCurrent = currentTrack?.id === track.id;

                return (
                  <div
                    key={track.id || idx}
                    onClick={() => onPlayTrack(track, popularTracksList)}
                    className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer group select-none ${isCurrent ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                      }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-xs font-mono text-[#6e686e] w-5 text-center group-hover:text-[#e6c8a2] transition-colors flex-shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <img
                        src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                        alt=""
                        onError={(e) => handleImageError(e)}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-semibold truncate group-hover:text-[#e6c8a2] transition-colors leading-tight ${isCurrent ? 'text-[#e6c8a2]' : 'text-white'
                          }`}>
                          {track.name}
                        </span>
                        <span className="text-[11px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                          {track.artists?.map(a => a.name).join(', ') || 'Artist'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 flex-shrink-0 pl-2">
                      <span className="text-xs font-mono text-[#8a8489]">
                        {formatTime(track.duration_ms ? track.duration_ms / 1000 : 210)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleLike) onToggleLike(track.id, track);
                        }}
                        className="text-[#6e686e] hover:text-[#e6c8a2] transition-colors p-1"
                        title="Like"
                      >
                        <Heart size={14} className={isTrackLiked ? "fill-[#e6c8a2] text-[#e6c8a2]" : ""} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. ADDITIONAL SECTION 1: FEATURED ARTISTS (Tailored by Streaming Region when guest) */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Featured Artists</h2>
            {!isAuthenticated && (
              <button
                onClick={() => setStreamRegion(prev => prev.code === 'IN' ? { code: 'GLOBAL', name: 'Global' } : { code: 'IN', name: 'India' })}
                className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] font-medium text-slate-300 transition-all backdrop-blur-xl group cursor-pointer"
                title="Click to toggle streaming region"
              >
                <span>{streamRegion.code === 'IN' ? '🇮🇳 India' : '🌐 Global'}</span>
                <span className="text-[9px] text-slate-500 group-hover:text-slate-300 ml-0.5 font-light">Switch</span>
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {activeFeaturedArtists.map((artist, idx) => (
            <div
              key={artist.name || idx}
              onClick={() => navigate(`/search?q=${encodeURIComponent(artist.query)}`)}
              className="p-3.5 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center text-center space-y-2.5 backdrop-blur-xl shadow-md select-none"
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-lg ring-2 ring-white/10 group-hover:ring-[#e6c8a2]/50 transition-all flex-shrink-0">
                <img
                  src={artist.avatar}
                  alt={artist.name}
                  onError={(e) => handleImageError(e, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500')}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                    <Play size={13} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="w-full px-1">
                <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:text-[#e6c8a2] transition-colors">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                  {artist.role}
                </p>
                <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                  {artist.listeners}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. ADDITIONAL SECTION 2: FRESH RELEASES & DROPS (Tailored by Streaming Region when guest) */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Fresh Releases & Drops</h2>
            {!isAuthenticated && (
              <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {streamRegion.code === 'IN' ? 'Trending in India' : 'Trending Worldwide'}
              </span>
            )}
          </div>
          <span className="text-xs text-[#8a8489]">320kbps CD Quality</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeFreshReleases.map((track) => (
            <div
              key={track.id}
              onClick={() => onPlayTrack(track, activeFreshReleases)}
              className="p-3 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex items-center space-x-3 backdrop-blur-xl shadow-md select-none"
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                <img
                  src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200'}
                  alt={track.name}
                  onError={(e) => handleImageError(e, 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200')}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play size={13} fill="currentColor" className="text-white ml-0.5" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-white truncate leading-tight group-hover:text-[#e6c8a2] transition-colors">
                  {track.name}
                </h4>
                <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                  {track.artists[0]?.name}
                </p>
                <span className="text-[9px] font-mono text-emerald-400/90 mt-0.5 block">Lossless Master</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
