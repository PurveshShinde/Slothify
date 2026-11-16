import React from 'react';
import type { Track } from '../types';

export interface HeroShowcaseTrack extends Track {
  quote: string;
  stats: string;
}

// 5 Curated Hero Showcase Songs for Top Bar & Mobile Rotator
export const FEATURED_HERO_TRACKS: HeroShowcaseTrack[] = [
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

export const DEFAULT_HERO_TRACK: Track = FEATURED_HERO_TRACKS[0];

// Rich Curated International Tracks (English Pop, Synth, Dark Pop, Alternative) - All verified 200 OK Spotify CDN Artworks
export const GUEST_INTERNATIONAL_TRACKS: Track[] = [
  {
    id: 'birds-of-a-feather-billie',
    uri: 'spotify:track:71d62ea7ea8a5be92d3c1f62',
    name: 'Birds of a Feather',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'HIT ME HARD AND SOFT',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62' }]
    },
    duration_ms: 196000
  },
  {
    id: 'cruel-summer-taylor',
    uri: 'spotify:track:e787cffec20aa2a396a61647',
    name: 'Cruel Summer',
    artists: [{ name: 'Taylor Swift' }],
    album: {
      name: 'Lover',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647' }]
    },
    duration_ms: 178000
  },
  {
    id: 'blinding-lights-weeknd',
    uri: 'spotify:track:8863bc11d2aa12b54f5aeb36',
    name: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }],
    album: {
      name: 'After Hours',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' }]
    },
    duration_ms: 200000
  },
  {
    id: 'starboy-weeknd',
    uri: 'spotify:track:4718e2b124f79258be7bc452',
    name: 'Starboy',
    artists: [{ name: 'The Weeknd, Daft Punk' }],
    album: {
      name: 'Starboy',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452' }]
    },
    duration_ms: 230000
  },
  {
    id: 'espresso-sabrina',
    uri: 'spotify:track:659cd4673230913b3918e0d5',
    name: 'Espresso',
    artists: [{ name: 'Sabrina Carpenter' }],
    album: {
      name: 'Short n\' Sweet',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273659cd4673230913b3918e0d5' }]
    },
    duration_ms: 175000
  },
  {
    id: 'die-with-a-smile-gaga',
    uri: 'spotify:track:82ea2e9e1858aa012c57cd45',
    name: 'Die With A Smile',
    artists: [{ name: 'Lady Gaga, Bruno Mars' }],
    album: {
      name: 'Die With A Smile',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27382ea2e9e1858aa012c57cd45' }]
    },
    duration_ms: 251000
  },
  {
    id: 'good-luck-babe-chappell',
    uri: 'spotify:track:91b4bc7c88d91a42e0f3a8b7',
    name: 'Good Luck, Babe!',
    artists: [{ name: 'Chappell Roan' }],
    album: {
      name: 'Good Luck, Babe!',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27391b4bc7c88d91a42e0f3a8b7' }]
    },
    duration_ms: 218000
  },
  {
    id: 'bad-guy-billie',
    uri: 'spotify:track:50a3147b0a5777716a87d394',
    name: 'bad guy',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27350a3147b0a5777716a87d394' }]
    },
    duration_ms: 194000
  },
  {
    id: 'everything-i-wanted-billie',
    uri: 'spotify:track:a216447c17d7e82643194a28',
    name: 'everything i wanted',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'everything i wanted',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273a216447c17d7e82643194a28' }]
    },
    duration_ms: 245000
  },
  {
    id: 'vampire-olivia',
    uri: 'spotify:track:e85259a1cae29a8d91f2093d',
    name: 'vampire',
    artists: [{ name: 'Olivia Rodrigo' }],
    album: {
      name: 'GUTS',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d' }]
    },
    duration_ms: 219000
  },
  {
    id: 'heat-waves-glass-animals',
    uri: 'spotify:track:9e495fb707973f3390850eea',
    name: 'Heat Waves',
    artists: [{ name: 'Glass Animals' }],
    album: {
      name: 'Dreamland',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2739e495fb707973f3390850eea' }]
    },
    duration_ms: 238000
  },
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
    id: 'isabel-larosa-favorite',
    uri: 'spotify:track:77f0a8d8763595eb99411603',
    name: 'Favorite',
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: 'Favorite',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27377f0a8d8763595eb99411603' }]
    },
    duration_ms: 134000
  },
  {
    id: 'isabel-larosa-im-yours',
    uri: 'spotify:track:62a758778be177ef4e5784ca',
    name: "i'm yours",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: "i'm yours",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27362a758778be177ef4e5784ca' }]
    },
    duration_ms: 154000
  },
  {
    id: 'dua-lipa-levitating',
    uri: 'spotify:track:bd26ede1ae69327010d49946',
    name: 'Levitating',
    artists: [{ name: 'Dua Lipa' }],
    album: {
      name: 'Future Nostalgia',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946' }]
    },
    duration_ms: 203000
  },
  {
    id: 'harry-styles-as-it-was',
    uri: 'spotify:track:2e8f738c6b8c9918a54c6e93',
    name: 'As It Was',
    artists: [{ name: 'Harry Styles' }],
    album: {
      name: "Harry's House",
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2732e8f738c6b8c9918a54c6e93' }]
    },
    duration_ms: 167000
  },
  {
    id: 'arctic-monkeys-do-i-wanna-know',
    uri: 'spotify:track:4ae1c4c5c45aabe5ece75734',
    name: 'Do I Wanna Know?',
    artists: [{ name: 'Arctic Monkeys' }],
    album: {
      name: 'AM',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe5ece75734' }]
    },
    duration_ms: 272000
  },
  {
    id: 'the-neighbourhood-sweater-weather',
    uri: 'spotify:track:099951167ee99723c31b81db',
    name: 'Sweater Weather',
    artists: [{ name: 'The Neighbourhood' }],
    album: {
      name: 'I Love You.',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273099951167ee99723c31b81db' }]
    },
    duration_ms: 240000
  },
  {
    id: '4yNk9iz9WVJikRFle3XEvn',
    uri: 'spotify:track:4yNk9iz9WVJikRFle3XEvn',
    name: 'golden hour',
    artists: [{ name: 'JVKE' }],
    album: {
      name: 'this is what ____ feels like',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730af4476af141051c728ee8b9' }]
    },
    duration_ms: 209000
  },
  {
    id: '3GWaFFi6TlPcZLYmCCHZ9O',
    uri: 'spotify:track:3GWaFFi6TlPcZLYmCCHZ9O',
    name: 'Teenage Dream',
    artists: [{ name: 'Stephen Dawes' }],
    album: {
      name: 'Teenage Dream',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273dfa368b8f51bb183328293bf' }]
    },
    duration_ms: 178000
  },
  {
    id: '1YEc4P48PIWSPNip6FaI3T',
    uri: 'spotify:track:1YEc4P48PIWSPNip6FaI3T',
    name: 'All That I Need',
    artists: [{ name: 'Matthew Ifield, Ebony Loren' }],
    album: {
      name: 'All That I Need',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27339a64d1fd9073af02b085e2b' }]
    },
    duration_ms: 222000
  }
];

// Rich Curated Hindi Tracks (Bollywood, Indie Soul, Acoustic Romantic) - All verified 200 OK Spotify CDN Artworks
export const GUEST_HINDI_TRACKS: Track[] = [
  {
    id: 'raataan-lambiyan-jubin',
    uri: 'spotify:track:2rOnSn2piaqLAlYjtfUBlY',
    name: 'Raataan Lambiyan',
    artists: [{ name: 'Jubin Nautiyal, Asees Kaur' }],
    album: {
      name: 'Shershaah',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27374aa42b31ece2c10fe5a4b93' }]
    },
    duration_ms: 230000
  },
  {
    id: 'tere-sang-yaara-atif',
    uri: 'spotify:track:72CkpVdvmc8t28o8I9N32J',
    name: 'Tere Sang Yaara',
    artists: [{ name: 'Atif Aslam' }],
    album: {
      name: 'Rustom',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2733a2753349e18d67b45e5b24d' }]
    },
    duration_ms: 290000
  },
  {
    id: 'labon-ko-kk',
    uri: 'spotify:track:0Pvj1IkAui0W6riEuPYkRc',
    name: 'Labon Ko',
    artists: [{ name: 'KK, Pritam' }],
    album: {
      name: 'Bhool Bhulaiyaa',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27371fdaca161565bffb287d7f7' }]
    },
    duration_ms: 344000
  },
  {
    id: 'channa-mereya-arijit',
    uri: 'spotify:track:1W3s3wlU1nPDslQRFDXqBf',
    name: 'Channa Mereya',
    artists: [{ name: 'Arijit Singh, Pritam' }],
    album: {
      name: 'Ae Dil Hai Mushkil',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2731aeef6268014e46bbb7b2421' }]
    },
    duration_ms: 289000
  },
  {
    id: 'baarishein-anuv-jain',
    uri: 'spotify:track:0sEjKsZdnyDfhuCIOMBCXx',
    name: 'Baarishein',
    artists: [{ name: 'Anuv Jain' }],
    album: {
      name: 'Baarishein',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273af820095eb4a9878be7c885e' }]
    },
    duration_ms: 207000
  },
  {
    id: 'tum-hi-ho-arijit-singh',
    uri: 'spotify:track:7ouBSPZKQpm7zQz2leJXta',
    name: 'Tum Hi Ho',
    artists: [{ name: 'Arijit Singh, Mithoon' }],
    album: {
      name: 'Aashiqui 2',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2731aa5adad8593923dcdf1a7d0' }]
    },
    duration_ms: 262000
  },
  {
    id: 'husn-anuv-jain',
    uri: 'spotify:track:husn-anuv-jain',
    name: 'Husn',
    artists: [{ name: 'Anuv Jain' }],
    album: {
      name: 'Husn',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2733944fdc1eff51f7be0a98cb8' }]
    },
    duration_ms: 218000
  },
  {
    id: 'kesariya-arijit-singh',
    uri: 'spotify:track:kesariya-arijit-singh',
    name: 'Kesariya',
    artists: [{ name: 'Arijit Singh, Pritam' }],
    album: {
      name: 'Brahmastra',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27346fdce5b3c0b5cce2b6f516e' }]
    },
    duration_ms: 268000
  },
  {
    id: 'apna-bana-le-arijit',
    uri: 'spotify:track:8a0fd84cc083a83bb307f2e3',
    name: 'Apna Bana Le',
    artists: [{ name: 'Arijit Singh, Sachin-Jigar' }],
    album: {
      name: 'Bhediya',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738a0fd84cc083a83bb307f2e3' }]
    },
    duration_ms: 261000
  },
  {
    id: 'agar-tum-saath-ho-arijit',
    uri: 'spotify:track:7f37ebc2e4efbb36f79d73b1',
    name: 'Agar Tum Saath Ho',
    artists: [{ name: 'Alka Yagnik, Arijit Singh' }],
    album: {
      name: 'Tamasha',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2737f37ebc2e4efbb36f79d73b1' }]
    },
    duration_ms: 341000
  },
  {
    id: 'kabira-arijit-singh',
    uri: 'spotify:track:011b67fad3083f48679c108a',
    name: 'Kabira',
    artists: [{ name: 'Tochi Raina, Rekha Bhardwaj' }],
    album: {
      name: 'Yeh Jawaani Hai Deewani',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273011b67fad3083f48679c108a' }]
    },
    duration_ms: 223000
  },
  {
    id: 'tera-ban-jaunga-akhil',
    uri: 'spotify:track:bd0bcaad5572e07566078144',
    name: 'Tera Ban Jaunga',
    artists: [{ name: 'Akhil Sachdeva, Tulsi Kumar' }],
    album: {
      name: 'Kabir Singh',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273bd0bcaad5572e07566078144' }]
    },
    duration_ms: 236000
  },
  {
    id: 'zara-sa-kk',
    uri: 'spotify:track:727d531901c07a499498c544',
    name: 'Zara Sa',
    artists: [{ name: 'KK, Pritam' }],
    album: {
      name: 'Jannat',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273727d531901c07a499498c544' }]
    },
    duration_ms: 303000
  },
  {
    id: 'jeene-laga-hoon-atif',
    uri: 'spotify:track:87118f5e1463ce140fde1a0c',
    name: 'Jeene Laga Hoon',
    artists: [{ name: 'Atif Aslam, Shreya Ghoshal' }],
    album: {
      name: 'Ramaiya Vastavaiya',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27387118f5e1463ce140fde1a0c' }]
    },
    duration_ms: 237000
  },
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
      images: [{ url: 'https://c.saavncdn.com/097/The-Rk-Magic-Hindi-2024-20251024161216-500x500.jpg' }]
    },
    duration_ms: 250000
  }
];

// Rich Curated Other Sort Tracks (Marathi Classics, Punjabi Hits) - All verified 200 OK Spotify CDN Artworks
export const GUEST_OTHER_TRACKS: Track[] = [
  {
    id: 'zingaat-ajay-atul',
    uri: 'spotify:track:3TysRQuZRfhXZ6P8T09YdO',
    name: 'Zingaat',
    artists: [{ name: 'Ajay-Atul' }],
    album: {
      name: 'Sairat',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2731c1d299d19bb5533d4daae07' }]
    },
    duration_ms: 226000
  },
  {
    id: 'tauba-tauba-karan-aujla',
    uri: 'spotify:track:25Nxyrng0Z3jC5Q0hAibpw',
    name: 'Tauba Tauba',
    artists: [{ name: 'Karan Aujla' }],
    album: {
      name: 'Bad Newz',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273b2f5a9e16c9bffab61b53d04' }]
    },
    duration_ms: 206000
  },
  {
    id: 'softly-karan-aujla',
    uri: 'spotify:track:38tSrWvBXuw1rGOe9izyc9',
    name: 'Softly',
    artists: [{ name: 'Karan Aujla, Ikky' }],
    album: {
      name: 'Making Memories',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273bc0ea09896599d2d8c2417f2' }]
    },
    duration_ms: 154000
  },
  {
    id: 'diljit-goat',
    uri: 'spotify:track:46QbY78ha62aiu6gBgC7lS',
    name: 'G.O.A.T.',
    artists: [{ name: 'Diljit Dosanjh' }],
    album: {
      name: 'G.O.A.T.',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e62ca3548e739bd85eebbbc9' }]
    },
    duration_ms: 223000
  },
  {
    id: 'ap-dhillon-excuses',
    uri: 'spotify:track:29m79w9xPMH4YCD6r8JSmV',
    name: 'Excuses',
    artists: [{ name: 'AP Dhillon, Gurinder Gill' }],
    album: {
      name: 'Excuses',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2735b74e703d6ffb2ea16860c86' }]
    },
    duration_ms: 176000
  },
  {
    id: 'swapnil-galavar-khali',
    uri: 'spotify:track:6BZepuMXX4rXsyH3JgWIot',
    name: 'Galavar Khali',
    artists: [{ name: 'Swapnil Bandodkar, Ajay-Atul' }],
    album: {
      name: 'Vedh',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273f72e624643abb25f3d61b351' }]
    },
    duration_ms: 284000
  },
  {
    id: 'man-udhan-varyache',
    uri: 'spotify:track:0q17pNmehWcNw0MzthBXkC',
    name: 'Man Udhan Varyache',
    artists: [{ name: 'Ajay-Atul, Shankar Mahadevan' }],
    album: {
      name: 'Agga Bai Arechhaa',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273a25ac54cf39cdd8e574dec1e' }]
    },
    duration_ms: 304000
  }
];

// Helper: Fisher-Yates array shuffler
export const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Curated dynamic guest mix themes
export const GUEST_MIX_CARDS = [
  {
    id: 'hindi-soul-mix',
    name: 'Hindi Soul & Acoustic',
    subtitle: 'Arijit Singh, Anuv Jain, Aditya Rikhari',
    image: 'https://i.scdn.co/image/ab67616d0000b2733944fdc1eff51f7be0a98cb8',
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
    image: 'https://i.scdn.co/image/ab67616d0000b273b2f5a9e16c9bffab61b53d04',
    query: 'Punjabi Hits'
  },
  {
    id: 'marathi-classics',
    name: 'Marathi Melodies',
    subtitle: 'Ajay-Atul, Swapnil Bandodkar',
    image: 'https://i.scdn.co/image/ab67616d0000b273f72e624643abb25f3d61b351',
    query: 'Marathi Classic Songs'
  },
  {
    id: 'international-lofi',
    name: 'International Chill & Indie',
    subtitle: 'Billie Eilish, Coldplay, Harry Styles',
    image: 'https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62',
    query: 'Indie Pop Hits'
  }
];

// Generates complete fresh random guest feed with guaranteed multi-genre balance and NO duplicate songs across sections
export const generateGuestFeed = () => {
  const intl = shuffleArray(GUEST_INTERNATIONAL_TRACKS);
  const hindi = shuffleArray(GUEST_HINDI_TRACKS);
  const regional = shuffleArray(GUEST_OTHER_TRACKS);

  // 1. Random Discoveries (5 tracks): balanced across International, Hindi & Regional
  const discoveryTracks: Track[] = shuffleArray([
    intl[0],
    intl[1],
    hindi[0],
    hindi[1],
    regional[0]
  ]);

  // 2. Popular tracks (4 tracks): 100% DISJOINT from discoveryTracks (indices 2+), never duplicate
  const popularTracks: Track[] = shuffleArray([
    intl[2],
    hindi[2],
    hindi[3],
    regional[1]
  ]);

  // 3. Fresh releases (5 tracks): from remaining pool
  const freshReleases: Track[] = shuffleArray([
    intl[3],
    intl[4],
    hindi[4],
    regional[2],
    regional[3]
  ]);

  return {
    popularTracks,
    discoveryTracks,
    freshReleases,
    madeForYou: shuffleArray(GUEST_MIX_CARDS)
  };
};

// Fallback arrays for authenticated initial state
export const DEFAULT_POPULAR_TRACKS: Track[] = GUEST_INTERNATIONAL_TRACKS.slice(0, 4);
export const DEFAULT_MADE_FOR_YOU = GUEST_MIX_CARDS;
export const DEFAULT_RECENT_TRACKS: Track[] = GUEST_INTERNATIONAL_TRACKS.slice(0, 5);

export interface FeaturedArtistItem {
  name: string;
  role: string;
  listeners: string;
  avatar: string;
  query: string;
}

// Global / International Featured Artists
export const GLOBAL_FEATURED_ARTISTS: FeaturedArtistItem[] = [
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
export const INDIA_FEATURED_ARTISTS: FeaturedArtistItem[] = [
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
export const EYES_DONT_LIE_TRACK: Track = {
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

export const TEENAGE_DREAM_TRACK: Track = {
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

export const ALL_THAT_I_NEED_TRACK: Track = {
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

export const GOLDEN_HOUR_TRACK: Track = {
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

export const SAHIBA_TRACK: Track = {
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

export const FAVORITE_TRACK: Track = {
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

export const KESARIYA_TRACK: Track = {
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

export const HUSN_TRACK: Track = {
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

export const TAUBA_TAUBA_TRACK: Track = {
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

export const DO_RE_MI_TRACK: Track = {
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

export const IM_YOURS_TRACK: Track = {
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
export const INDIA_FRESH_RELEASES: Track[] = [
  EYES_DONT_LIE_TRACK,
  TEENAGE_DREAM_TRACK,
  ALL_THAT_I_NEED_TRACK,
  GOLDEN_HOUR_TRACK,
  SAHIBA_TRACK
];

export const GLOBAL_FRESH_RELEASES: Track[] = [
  EYES_DONT_LIE_TRACK,
  TEENAGE_DREAM_TRACK,
  ALL_THAT_I_NEED_TRACK,
  GOLDEN_HOUR_TRACK,
  FAVORITE_TRACK
];

// Helper: detect streaming region from client timezone & locale
export const detectUserRegion = (): { code: 'IN' | 'GLOBAL'; name: string } => {
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

// Curated distinct atmospheric music artworks for resilient fallbacks (never repetitive yellow photos)
export const STYLISH_FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500',
  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500'
];

// Resilient universal image fallback helper with deterministic unique rotation
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  customFallback?: string
) => {
  const target = e.currentTarget;
  const key = (target.alt || target.title || 'album').trim();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const fallback = customFallback || STYLISH_FALLBACK_COVERS[Math.abs(hash) % STYLISH_FALLBACK_COVERS.length];
  if (target.src !== fallback) {
    target.onerror = null;
    target.src = fallback;
  }
};

export const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

