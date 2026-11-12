/**
 * Normalizes user search queries by removing 'by', parenthetical text, quotes, and extra whitespace.
 */
export function cleanSearchQuery(q: string): string {
    return q
        .replace(/\bby\b/gi, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/["'’]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

