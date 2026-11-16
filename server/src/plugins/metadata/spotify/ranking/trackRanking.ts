import { calculateSimilarity, isArtistNameMatch } from '../utils/similarityUtils.js';
import { TOP_ARTIST_PROFILES } from '../catalogs/topArtistsCatalog.js';

/**
 * Normalizes JioSaavn play_count metric to a 1-100 popularity score matching Spotify's scale
 */
export function normalizePlayCountToPopularity(playCount: number): number {
    if (!playCount || playCount <= 1000) return 10;
    if (playCount <= 50000) return Math.min(25, Math.round(10 + (playCount / 50000) * 15));
    if (playCount <= 500000) return Math.min(45, Math.round(25 + ((playCount - 50000) / 450000) * 20));
    if (playCount <= 5000000) return Math.min(70, Math.round(45 + ((playCount - 500000) / 4500000) * 25));
    if (playCount <= 50000000) return Math.min(90, Math.round(70 + ((playCount - 5000000) / 45000000) * 20));
    return Math.min(100, Math.round(90 + (Math.log10(playCount) - 7.7) * 10));
}

export function scoreTrackRelevance(track: any, query: string, originalIndex: number = 0): number {
    let score = 0;
    const cleanQuery = (query || '').toLowerCase().trim();
    const trackTitle = (track.name || track.title || '').toLowerCase().trim();
    const artistNames = (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name) : [track.artist || ''])
        .filter(Boolean)
        .map((n: string) => n.toLowerCase().trim());
    const primaryArtist = artistNames[0] || '';

    // 1. Fuzzy Matching on Title (Handles "saheba" vs "sahiba")
    const baseTitle = trackTitle
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
    const cleanQueryAlnum = cleanQuery.replace(/[^a-zA-Z0-9]/g, '');

    let titleMatched = false;
    if (trackTitle === cleanQuery || (baseTitle && baseTitle === cleanQueryAlnum)) {
        score += 100;
        titleMatched = true;
    } else if (
        trackTitle.includes(cleanQuery) || 
        (baseTitle && baseTitle.includes(cleanQueryAlnum)) ||
        calculateSimilarity(trackTitle, cleanQuery) > 0.8 ||
        (baseTitle && cleanQueryAlnum && calculateSimilarity(baseTitle, cleanQueryAlnum) > 0.8)
    ) {
        score += 50; 
        titleMatched = true;
    }

    // 2. Artist Matching: When searching for an artist (e.g. "Drake" or "Arijit Singh"), award +100 for primary artist match
    // This ensures Drake's hits crush an obscure indie song whose title happens to be "Drake".
    const isArtistExact = artistNames.some((a: string) => a === cleanQuery || isArtistNameMatch(a, cleanQuery));
    const isArtistFuzzy = !isArtistExact && artistNames.some((a: string) => a.includes(cleanQuery) || calculateSimilarity(a, cleanQuery) > 0.8);

    // Spam Knockoff Detection:
    // If an artist names themselves after the exact song title (e.g., song "Shape of You" by artist "Shape of You"),
    // this is a known SEO spam knockoff intended to hijack search results. Heavily penalize it!
    const isArtistSpamKnockoff = Boolean(
        primaryArtist && (
            primaryArtist === trackTitle || 
            primaryArtist.replace(/[^a-zA-Z0-9]/g, '') === baseTitle ||
            (titleMatched && primaryArtist === cleanQuery)
        )
    );

    if (isArtistSpamKnockoff) {
        score -= 150;
    } else if (isArtistExact) {
        if (!titleMatched) {
            score += 100;
        } else {
            score += 10;
        }
    } else if (isArtistFuzzy) {
        if (!titleMatched) {
            score += 50;
        }
    } else if (cleanQuery.includes(' ') && (trackTitle + ' ' + primaryArtist).includes(cleanQuery)) {
        score += 40;
    }

    // Cover / Tribute / Karaoke penalty (e.g. "Originally Performed by ...")
    const isCoverOrTribute = /\b(originally performed by|tribute to|cover version|backing track|in the style of)\b/i.test(trackTitle) ||
        /\b(originally performed by|tribute to|cover version|backing track|in the style of)\b/i.test(primaryArtist);
    if (isCoverOrTribute && !cleanQuery.includes('cover') && !cleanQuery.includes('tribute')) {
        score -= 100;
    }

    // Low-Play Cover Artist Suppression:
    // If an obscure artist with < 200,000 plays covers a famous song, penalize so knockoffs don't crowd search
    const playCount = Number((track as any).playCount) || 0;
    const isLowPlayCover = playCount > 0 && playCount < 200000 && !isArtistExact;
    if (isLowPlayCover && !cleanQuery.includes(primaryArtist)) {
        score -= 120;
    }

    // 3. Spotify Engine Original Rank Priority:
    // Spotify's GraphQL search incorporates billions of user streams and global listening signals.
    // Index 0 in Spotify's official search is almost always the canonical hit!
    if (originalIndex === 0) {
        score += 90;
    } else if (originalIndex === 1) {
        score += 55;
    } else if (originalIndex === 2) {
        score += 35;
    } else if (originalIndex <= 5) {
        score += 20;
    }

    // 4. Recognized Major Artist Bonus:
    // Authentic global chart stars (Ed Sheeran, Taylor Swift, The Weeknd, etc.) should not be displaced by amateur knockoffs
    const isMajorArtist = artistNames.some((a: string) => 
        TOP_ARTIST_PROFILES[a] || 
        (track as any).followers > 50000
    );
    if (isMajorArtist) {
        score += titleMatched ? 80 : 40;
    }

    // 5. Track Popularity Multiplier (Crucial for generic searches)
    // Spotify returns a 'popularity' metric. If JioSaavn has 'playCount', normalize it to 1-100.
    const trackPopularity = track.popularity || 10; // Default to low if unknown
    
    // Multiply the base score by the popularity weight. 
    // This ensures a massive hit like "Sahiba" crushes an obscure song named "Saheba".
    score += (trackPopularity * 1.5); 

    return score;
}

/**
 * Smart Deduplication Fingerprinting:
 * Groups tracks by normalized raw signature `${baseTitle}` and shared artist tokens.
 * Keeps the highest quality version (highest score / Spotify CDN cover art), sorted by highest score first.
 */
export function deduplicateTracks(tracks: any[]): any[] {
    const uniqueTracks: any[] = [];
    const junkSubRegex = /\b(tribute|karaoke|instrumental\s*version|backing\s*track|8-?bit|16-?bit|type\s*beat|string\s*quartet|chiptune|arcade\s*player|workout|fitness|gym|nightcore|bpm|tabata|hardtekk|hardstyle|switching\s*vocals|cover\s*version|female\s*cover)\b/i;

    tracks.forEach(track => {
        const titleStr = (track.name || track.title || '').toLowerCase();
        const rawArtistStr = (Array.isArray(track.artists) && track.artists.length > 0)
            ? track.artists.map((a: any) => a.name).join(' ').toLowerCase()
            : (track.artist || 'unknown').toLowerCase();

        // Extra safety filter against tribute/backing track/type beat/workout junk
        if (junkSubRegex.test(titleStr) || junkSubRegex.test(rawArtistStr)) {
            return;
        }

        // Create a raw fingerprint: remove special chars, parentheses, version info, and spaces
        const baseTitle = titleStr
            .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
            .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();

        // Extract individual artist tokens
        const artistTokens = ((Array.isArray(track.artists) && track.artists.length > 0)
            ? track.artists.flatMap((a: any) => String(a.name || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
            : String(track.artist || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
            .map((a: string) => a.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim())
            .filter(Boolean);

        const primaryArtistToken = artistTokens[0] || 'unknown';

        // Check if an existing unique track shares the exact same baseTitle AND at least one major artist
        const existingIndex = uniqueTracks.findIndex(u => {
            const uTitleStr = (u.name || u.title || '').toLowerCase();
            const uBaseTitle = uTitleStr
                .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
                .replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toLowerCase();

            if (uBaseTitle !== baseTitle) return false;

            const uTokens = ((Array.isArray(u.artists) && u.artists.length > 0)
                ? u.artists.flatMap((a: any) => String(a.name || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
                : String(u.artist || '').split(/[,x&•|–-]|\bfeat\.?|\bft\.?|\bwith\b/i))
                .map((a: string) => a.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim())
                .filter(Boolean);

            // Match if primary artist matches OR any artist token matches
            return uTokens.includes(primaryArtistToken) || artistTokens.some((tok: string) => uTokens.includes(tok));
        });

        const currentScore = track.score ?? 0;
        if (existingIndex === -1) {
            uniqueTracks.push(track);
        } else {
            const existing = uniqueTracks[existingIndex];
            const existingScore = existing.score ?? 0;
            const currentIsSpotify = Boolean(track.uri?.startsWith('spotify:track:') && !track.id?.startsWith('saavn_'));
            const existingIsSpotify = Boolean(existing.uri?.startsWith('spotify:track:') && !existing.id?.startsWith('saavn_'));

            // Rule 0: Clean Original Studio Track vs Version (Acoustic, Live, Remix, etc.)
            // The clean original studio recording MUST NEVER be overwritten by an acoustic or live version!
            const versionRegex = /\b(acoustic|live|unplugged|radio edit|club mix|extended|instrumental|orchestral)\b/i;
            const isCurrentVersion = versionRegex.test(track.name || '');
            const isExistingVersion = versionRegex.test(existing.name || '');

            if (!isExistingVersion && isCurrentVersion) {
                // Existing is the clean original; keep it, never overwrite with acoustic/version!
                return;
            }
            if (isExistingVersion && !isCurrentVersion) {
                // Current is clean original studio recording; replace the acoustic/version!
                uniqueTracks[existingIndex] = track;
                return;
            }

            // Rule 1: Official Spotify releases have authentic global cover art and master metadata.
            // If current track is Spotify and existing is NOT Spotify, Spotify ALWAYS takes precedence!
            if (currentIsSpotify && !existingIsSpotify) {
                if ((existing as any).playCount) {
                    (track as any).playCount = (existing as any).playCount;
                    (track as any).popularity = Math.max((track as any).popularity || 0, (existing as any).popularity || 0);
                }
                uniqueTracks[existingIndex] = track;
            } else if (!currentIsSpotify && existingIsSpotify) {
                // Keep the official Spotify track, borrowing playCount metric if available
                if ((track as any).playCount) {
                    (existing as any).playCount = (track as any).playCount;
                }
            } else {
                // Both are from same provider. Strongly prefer original studio release over promotional compilations
                const compilationRegex = /\b(party|hits|best of|top 100|collection|various artists|greatest hits|compilation|remix|pop \d{4}|\b\d{4}\b|now that'?s)\b/i;
                const isCurrentCompilation = compilationRegex.test(track.album?.name || '');
                const isExistingCompilation = compilationRegex.test(existing.album?.name || '');

                if (!isCurrentCompilation && isExistingCompilation) {
                    uniqueTracks[existingIndex] = track;
                } else if (currentScore > existingScore && (isCurrentCompilation === isExistingCompilation)) {
                    uniqueTracks[existingIndex] = track;
                }
            }
        }
    });

    // Sort final unique list by highest score first
    return uniqueTracks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

