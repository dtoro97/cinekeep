const HTML_ENTITIES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
};

/**
 * Turns review markdown into plain text for clamped excerpts, so markers like `*feeling*`
 * or `[link](url)` don't show up literally. The full review still renders the markdown.
 */
export const toReviewPreviewText = (markdown: string): string =>
    markdown
        .replace(/<[^>]*>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>)\s?/gm, '')
        .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
        .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/(^|[^\w*])[*_](?=\S)([^*_\n]*?\S)[*_](?![\w*])/g, '$1$2')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/&(?:amp|quot|#39|apos|lt|gt|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
        .replace(/\s+/g, ' ')
        .trim();
