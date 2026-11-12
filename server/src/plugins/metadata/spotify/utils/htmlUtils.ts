/**
 * Decodes standard HTML entities in strings or metadata object properties.
 */
export function decodeHtmlEntities(str: any): string {
    if (!str) return '';
    let val = str;
    if (typeof val !== 'string') {
        if (typeof val === 'object' && val.name) val = val.name;
        else if (typeof val === 'object' && val.title) val = val.title;
        else val = String(val || '');
    }
    return val
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

