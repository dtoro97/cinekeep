import type { MediaType } from '../types/media.types';

/** `toMediaKey('tv', 1399)` → `tv:1399`: one title, across TMDb and CineKeep data. */
export const toMediaKey = (mediaType: MediaType, id: number): string => `${mediaType}:${id}`;
