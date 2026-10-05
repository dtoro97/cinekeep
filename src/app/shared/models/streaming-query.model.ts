import type { MediaType } from '../types/media.types';
import type { TmdbDiscoverSortKey, TmdbWatchMonetizationType } from './tmdb-discover-query.model';

export type StreamingDatePreset = 'today' | 'current-month' | 'current-season' | 'current-two-months';

/** A streaming list's filters, before they become one TMDb request per media type. */
export interface StreamingBaseQuery {
    readonly mediaTypes: readonly MediaType[];
    readonly providerIds?: readonly number[];
    readonly monetization?: TmdbWatchMonetizationType;
    readonly genreIds?: readonly number[];
    readonly excludedGenreIds?: readonly number[];
    readonly keywordIds?: readonly number[];
    readonly originalLanguage?: string;
    readonly originCountry?: string;
    readonly datePreset?: StreamingDatePreset;
    readonly runtimeMax?: number;
    readonly voteAverageMin?: number;
    readonly voteCountMin?: number;
    readonly voteCountMax?: number;
    readonly sortBy: TmdbDiscoverSortKey;
}

export const STREAMING_THIS_MONTH_SLUG = 'streaming-this-month';
