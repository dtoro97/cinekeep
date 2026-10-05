import type { MediaType } from '../types/media.types';
import type { SortDirection } from '../types/sort.types';

export const TMDB_DISCOVER_SORT_KEYS = ['popularity', 'rating', 'release_date', 'title', 'vote_count'] as const;

export type TmdbDiscoverSortKey = (typeof TMDB_DISCOVER_SORT_KEYS)[number];

export type TmdbWatchMonetizationType = 'ads' | 'buy' | 'flatrate' | 'free' | 'rent';

export interface TmdbDateRange {
    readonly from?: string;
    readonly to?: string;
}

/** One TMDb discover request for movies or TV series; filters left unset are not sent. */
export interface TmdbDiscoverQuery {
    readonly mediaType: MediaType;
    readonly sortKey: TmdbDiscoverSortKey;
    readonly sortDirection: SortDirection;
    readonly page?: number;
    /** The region for providers, monetization, certification and release dates; the locale's region when unset. */
    readonly watchRegion?: string;
    readonly genreIds?: readonly number[];
    readonly excludedGenreIds?: readonly number[];
    readonly keywordIds?: readonly number[];
    /** Titles from any of these companies. */
    readonly companyIds?: readonly number[];
    /** Titles on any of these providers. */
    readonly providerIds?: readonly number[];
    readonly monetization?: TmdbWatchMonetizationType;
    readonly originalLanguage?: string | null;
    readonly originCountry?: string;
    /** Movies only: the rating in the watch region. */
    readonly certification?: string | null;
    /** Movies only, e.g. theatrical (3); release dates then count only releases of that type. */
    readonly releaseType?: number | null;
    /** Movies: a release in the watch region. TV series: an episode airing. */
    readonly releaseDates?: TmdbDateRange;
    /** Movies: the first release anywhere. TV series: the first episode. */
    readonly firstReleaseDates?: TmdbDateRange;
    /** TV series only: the timezone air dates are read in. */
    readonly timezone?: string;
    readonly runtimeMin?: number;
    readonly runtimeMax?: number;
    readonly voteAverageMin?: number | null;
    readonly voteCountMin?: number | null;
    readonly voteCountMax?: number;
}
