/**
 * Calculates string similarity between 0.0 and 1.0 using Levenshtein distance
 */
export function stringSimilarity(s1: string, s2: string): number {
    let longer = s1.toLowerCase().trim();
    let shorter = s2.toLowerCase().trim();
    if (longer.length < shorter.length) {
        const tmp = longer;
        longer = shorter;
        shorter = tmp;
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const costs: number[] = [];
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longerLength - costs[shorter.length]) / parseFloat(longerLength.toString());
}

/**
 * Calculates string similarity between 0.0 and 1.0 using Levenshtein distance
 */
export function calculateSimilarity(s1: string, s2: string): number {
    return stringSimilarity(s1, s2);
}

/**
 * Composite Relevance Scoring Algorithm for Artists
 * 1. Text Relevance:
 *    - Exact match: 70
 *    - Prefix / word start: 60 (e.g. "Dove Cameron" for query "dove")
 *    - Prefix generic: 48 (e.g. "Dover" for query "dove")
 *    - Word match: 40 (e.g. "Niki & The Dove" for query "dove")
 *    - Substring: 20
 *    - Fuzzy / typo match: up to 50
 * 2. Popularity Multiplier:
 *    - Logarithmic scale of follower count: 6 * log10(followers)
 *    - Elevates massive artists (e.g. Dove Cameron with 677K fans) above obscure bands with 8 or 342 followers
 */
export function calculateArtistRelevanceScore(artist: { name: string; followers?: { total: number } | number }, query: string): number {
    const q = (query || '').toLowerCase().trim();
    const name = (artist.name || '').toLowerCase().trim();
    if (!q || !name) return 0;

    const rawFollowers = typeof artist.followers === 'object' && artist.followers !== null
        ? artist.followers.total
        : typeof artist.followers === 'number'
            ? artist.followers
            : 0;

    const followers = Math.max(rawFollowers || 0, 1);
    const logFollowers = Math.log10(followers); // 0 to ~8.5

    let textScore = 0;
    if (name === q) {
        textScore = 70;
    } else if (name.startsWith(q + ' ') || name.startsWith(q + '-')) {
        textScore = 60;
    } else if (name.startsWith(q)) {
        textScore = 48;
    } else if (name.split(/\s+/).some(w => w === q || w.startsWith(q))) {
        textScore = 40;
    } else if (name.includes(q)) {
        textScore = 20;
    } else {
        const sim = stringSimilarity(name, q);
        if (sim >= 0.7) {
            textScore = sim * 50;
        }
    }

    const popScore = logFollowers * 6;
    return textScore + popScore;
}

export function isArtistNameMatch(artistName: string, query: string): boolean {
    if (!artistName || !query) return false;

    const normName = artistName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();

    const normQuery = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();

    if (!normName || !normQuery) return false;

    // Direct substring match
    if (normName.includes(normQuery) || normQuery.includes(normName)) {
        return true;
    }

    // Token prefix matching (e.g. "dove came" matches "Dove Cameron")
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);
    const nameTokens = normName.split(/\s+/).filter(Boolean);

    if (queryTokens.length > 0 && queryTokens.every(qTok => 
        nameTokens.some(nTok => nTok.startsWith(qTok) || nTok === qTok)
    )) {
        return true;
    }

    // Condensed check without spaces (e.g. "dovecameron" matches "dovcame")
    const condensedName = normName.replace(/\s+/g, '');
    const condensedQuery = normQuery.replace(/\s+/g, '');
    if (condensedName.startsWith(condensedQuery) || condensedQuery.startsWith(condensedName)) {
        return true;
    }

    // Typo tolerance: Levenshtein distance check for query length >= 3
    if (normQuery.length >= 3) {
        if (stringSimilarity(normName, normQuery) >= 0.72) return true;
        if (stringSimilarity(condensedName, condensedQuery) >= 0.72) return true;
        if (queryTokens.length === nameTokens.length) {
            if (queryTokens.every((qTok, i) => {
                const nTok = nameTokens[i];
                return nTok && (nTok.startsWith(qTok) || stringSimilarity(nTok, qTok) >= 0.7);
            })) return true;
        }
    }

    return false;
}

