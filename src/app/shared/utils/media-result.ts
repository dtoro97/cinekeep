import type { MediaType } from '../types/media.types';

/** Narrows a trending or multi-search result to a movie or TV series, leaving out people. */
export const isMediaResult = <T extends { readonly media_type?: string }>(
    item: T,
): item is T & { readonly media_type: MediaType } => item.media_type === 'movie' || item.media_type === 'tv';
