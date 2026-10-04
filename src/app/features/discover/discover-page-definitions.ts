import type { MediaType, SelectOption, SortDirection, TmdbDiscoverSortKey } from '../../shared';
import {
    CURATED_TV_EXCLUDED_GENRE_IDS,
    DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
    DEFAULT_DISCOVER_VOTE_COUNT_GTE,
} from '../../constants';

export type DiscoverPageMode = 'advanced' | 'browse';
export type DiscoverRuntimePreset = 'any' | 'short' | 'standard' | 'long';
export type DiscoverDateWindow = 'airing-today' | 'now-playing' | 'on-the-air' | 'upcoming';
export type DiscoverMovieReleaseTypeFilter = 'theatrical';
export type DiscoverMovieReleaseType = 1 | 2 | 3 | 4 | 5 | 6;

export type DiscoverSortKey = TmdbDiscoverSortKey;

export type DiscoverPageKey =
    | 'advanced'
    | 'movie-popular'
    | 'movie-top-rated'
    | 'movie-now-playing'
    | 'movie-upcoming'
    | 'tv-popular'
    | 'tv-top-rated'
    | 'tv-airing-today'
    | 'tv-on-the-air';

export interface DiscoverFilterVisibility {
    readonly genres: boolean;
    readonly keywords: boolean;
    readonly companies: boolean;
    readonly yearRange: boolean;
    readonly watchRegion: boolean;
    readonly providers: boolean;
    readonly certification: boolean;
    readonly releaseType: boolean;
    readonly language: boolean;
    readonly rating: boolean;
    readonly votes: boolean;
    readonly runtime: boolean;
}

export interface DiscoverLockedFilterDefinition {
    readonly id: string;
    readonly label: string;
}

export interface DiscoverGenreExclusion {
    readonly genreIds: readonly number[];
    readonly label: string;
}

export interface DiscoverPageDefinition {
    readonly key: DiscoverPageKey;
    readonly title: string;
    /** Only when it adds something the title and visible filters don't already say. */
    readonly subtitle?: string;
    readonly mediaType: MediaType;
    readonly mode: DiscoverPageMode;
    readonly defaultSortKey: DiscoverSortKey;
    readonly defaultSortDirection: SortDirection;
    readonly showSort: boolean;
    readonly filters: DiscoverFilterVisibility;
    readonly dateWindow?: DiscoverDateWindow;
    readonly movieReleaseTypeFilter?: DiscoverMovieReleaseTypeFilter;
    readonly defaultVoteCountGte?: number;
    readonly lockedVoteCountGte?: number;
    /** Genres left out by default; users can remove the exclusion like any other active filter. */
    readonly defaultGenreExclusion?: DiscoverGenreExclusion;
    readonly lockedFilters?: readonly DiscoverLockedFilterDefinition[];
}

export interface DiscoverFilterState {
    readonly genreIds: readonly number[];
    readonly excludedGenreIds: readonly number[];
    readonly keywordIds: readonly number[];
    readonly companyIds: readonly number[];
    readonly providerIds: readonly number[];
    readonly yearFrom: number | null;
    readonly yearTo: number | null;
    readonly certification: string | null;
    readonly releaseType: DiscoverMovieReleaseType | null;
    readonly originalLanguage: string | null;
    readonly voteAverageGte: number | null;
    readonly voteCountGte: number | null;
    readonly runtimePreset: DiscoverRuntimePreset;
}

/** A change from the filter panel; the search keys carry the typed text. */
export type DiscoverFilterChange =
    | { readonly key: 'keywordSearch' | 'companySearch'; readonly value: string }
    | {
          readonly key:
              | 'genres'
              | 'keyword'
              | 'company'
              | 'yearFrom'
              | 'yearTo'
              | 'watchRegion'
              | 'providers'
              | 'certification'
              | 'releaseType'
              | 'language'
              | 'rating'
              | 'votes'
              | 'runtime';
          readonly value: unknown;
      };

/** Everything the filter panel renders: which filters show, their options, and the current values. */
export interface DiscoverFilters {
    readonly activeFilterCount: number;
    /** Active filters inside the collapsed "More filters" group. */
    readonly moreActiveCount: number;
    /** Whether any filter in the "More filters" group applies to this page. */
    readonly hasMoreFilters: boolean;
    readonly visible: DiscoverFilterVisibility;
    readonly genreOptions: readonly SelectOption<number>[];
    readonly selectedGenreIds: readonly number[];
    readonly keywordSuggestions: readonly SelectOption<number>[];
    readonly companySuggestions: readonly SelectOption<number>[];
    readonly yearFrom: number | null;
    readonly yearTo: number | null;
    readonly watchRegionOptions: readonly SelectOption<string>[];
    readonly watchRegion: string;
    readonly providerOptions: readonly SelectOption<number>[];
    readonly selectedProviderIds: readonly number[];
    readonly certificationOptions: readonly SelectOption<string | null>[];
    readonly certification: string | null;
    readonly releaseTypeOptions: readonly SelectOption<DiscoverMovieReleaseType | null>[];
    readonly releaseType: DiscoverMovieReleaseType | null;
    readonly languageOptions: readonly SelectOption<string>[];
    readonly language: string | null;
    readonly ratingOptions: readonly SelectOption<number | null>[];
    readonly rating: number | null;
    readonly voteCountOptions: readonly SelectOption<number | null>[];
    readonly voteCount: number | null;
    readonly runtimeOptions: readonly SelectOption<DiscoverRuntimePreset>[];
    readonly runtime: DiscoverRuntimePreset;
}

export interface DiscoverQueryState extends DiscoverFilterState {
    readonly mediaType: MediaType;
    readonly sortKey: DiscoverSortKey;
    readonly sortDirection: SortDirection;
    readonly watchRegion: string;
}

export const DISCOVER_DEFAULT_FILTERS: DiscoverFilterState = {
    genreIds: [],
    excludedGenreIds: [],
    keywordIds: [],
    companyIds: [],
    providerIds: [],
    yearFrom: null,
    yearTo: null,
    certification: null,
    releaseType: null,
    originalLanguage: null,
    voteAverageGte: null,
    voteCountGte: null,
    runtimePreset: 'any',
};

const ADVANCED_FILTERS: DiscoverFilterVisibility = {
    genres: true,
    keywords: true,
    companies: true,
    yearRange: true,
    watchRegion: true,
    providers: true,
    certification: true,
    releaseType: true,
    language: true,
    rating: true,
    votes: true,
    runtime: true,
};

const MOVIE_BROWSE_FILTERS: DiscoverFilterVisibility = {
    ...ADVANCED_FILTERS,
    keywords: false,
    companies: false,
    providers: false,
};

const MOVIE_TOP_RATED_FILTERS: DiscoverFilterVisibility = {
    ...MOVIE_BROWSE_FILTERS,
    votes: false,
};

const MOVIE_NOW_PLAYING_FILTERS: DiscoverFilterVisibility = {
    ...MOVIE_BROWSE_FILTERS,
    yearRange: false,
    releaseType: false,
};

const MOVIE_UPCOMING_FILTERS: DiscoverFilterVisibility = {
    ...MOVIE_NOW_PLAYING_FILTERS,
    rating: false,
    votes: false,
};

const TV_BROWSE_FILTERS: DiscoverFilterVisibility = {
    ...ADVANCED_FILTERS,
    keywords: false,
    companies: false,
    certification: false,
    releaseType: false,
};

const TV_TOP_RATED_FILTERS: DiscoverFilterVisibility = {
    ...TV_BROWSE_FILTERS,
    votes: false,
};

const TV_DATE_WINDOW_FILTERS: DiscoverFilterVisibility = {
    ...TV_BROWSE_FILTERS,
    yearRange: false,
};

const TOP_RATED_LOCKED_FILTERS: readonly DiscoverLockedFilterDefinition[] = [
    { id: 'minimum-votes', label: 'Minimum votes: 5000+' },
];

export const DISCOVER_PAGE_DEFINITIONS: Record<DiscoverPageKey, DiscoverPageDefinition> = {
    advanced: {
        key: 'advanced',
        title: 'Discover Movies & TV',
        mediaType: 'movie',
        mode: 'advanced',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: true,
        filters: ADVANCED_FILTERS,
        defaultVoteCountGte: DEFAULT_DISCOVER_VOTE_COUNT_GTE,
    },
    'movie-popular': {
        key: 'movie-popular',
        title: 'Popular Movies',
        mediaType: 'movie',
        mode: 'browse',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: MOVIE_BROWSE_FILTERS,
        defaultVoteCountGte: DEFAULT_DISCOVER_VOTE_COUNT_GTE,
    },
    'movie-top-rated': {
        key: 'movie-top-rated',
        title: 'Top Rated Movies',
        subtitle: 'Ranked by audience rating.',
        mediaType: 'movie',
        mode: 'browse',
        defaultSortKey: 'rating',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: MOVIE_TOP_RATED_FILTERS,
        lockedVoteCountGte: 5000,
        lockedFilters: TOP_RATED_LOCKED_FILTERS,
    },
    'movie-now-playing': {
        key: 'movie-now-playing',
        title: 'Now Playing Movies',
        mediaType: 'movie',
        mode: 'browse',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: MOVIE_NOW_PLAYING_FILTERS,
        dateWindow: 'now-playing',
        movieReleaseTypeFilter: 'theatrical',
        defaultVoteCountGte: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
        lockedFilters: [{ id: 'in-theatres', label: 'In theatres' }],
    },
    'movie-upcoming': {
        key: 'movie-upcoming',
        title: 'Upcoming Movies',
        mediaType: 'movie',
        mode: 'browse',
        defaultSortKey: 'release_date',
        defaultSortDirection: 'asc',
        showSort: false,
        filters: MOVIE_UPCOMING_FILTERS,
        dateWindow: 'upcoming',
        movieReleaseTypeFilter: 'theatrical',
        lockedFilters: [
            { id: 'opening-soon', label: 'Next 2 weeks' },
            { id: 'theatrical', label: 'Theatrical' },
        ],
    },
    'tv-popular': {
        key: 'tv-popular',
        title: 'Popular TV Series',
        mediaType: 'tv',
        mode: 'browse',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: TV_BROWSE_FILTERS,
        defaultVoteCountGte: DEFAULT_DISCOVER_VOTE_COUNT_GTE,
    },
    'tv-top-rated': {
        key: 'tv-top-rated',
        title: 'Top Rated TV Series',
        subtitle: 'Ranked by audience rating.',
        mediaType: 'tv',
        mode: 'browse',
        defaultSortKey: 'rating',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: TV_TOP_RATED_FILTERS,
        lockedVoteCountGte: 5000,
        lockedFilters: TOP_RATED_LOCKED_FILTERS,
    },
    'tv-airing-today': {
        key: 'tv-airing-today',
        title: 'TV Series Airing Today',
        mediaType: 'tv',
        mode: 'browse',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: TV_DATE_WINDOW_FILTERS,
        dateWindow: 'airing-today',
        defaultVoteCountGte: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
        defaultGenreExclusion: {
            genreIds: CURATED_TV_EXCLUDED_GENRE_IDS,
            label: 'No talk, news, reality or soaps',
        },
        lockedFilters: [{ id: 'airing-today', label: 'Airing today' }],
    },
    'tv-on-the-air': {
        key: 'tv-on-the-air',
        title: 'TV Series Airing This Week',
        mediaType: 'tv',
        mode: 'browse',
        defaultSortKey: 'popularity',
        defaultSortDirection: 'desc',
        showSort: false,
        filters: TV_DATE_WINDOW_FILTERS,
        dateWindow: 'on-the-air',
        defaultVoteCountGte: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
        lockedFilters: [{ id: 'on-the-air', label: 'On TV this week' }],
    },
};

export const RATING_FILTER_OPTIONS = [
    { label: 'Any rating', value: null },
    { label: '6+', value: 6 },
    { label: '7+', value: 7 },
    { label: '8+', value: 8 },
] as const;

export const VOTE_COUNT_FILTER_OPTIONS = [
    { label: 'Any vote count', value: null },
    { label: '50+', value: 50 },
    { label: '250+', value: 250 },
    { label: '1000+', value: 1000 },
    { label: '5000+', value: 5000 },
] as const;

export const MOVIE_RELEASE_TYPE_FILTER_OPTIONS = [
    { label: 'Any release type', value: null },
    { label: 'Premiere', value: 1 },
    { label: 'Limited theatrical', value: 2 },
    { label: 'Theatrical', value: 3 },
    { label: 'Digital', value: 4 },
    { label: 'Physical', value: 5 },
    { label: 'TV', value: 6 },
] as const;

export const RUNTIME_FILTER_OPTIONS = [
    { label: 'Any runtime', value: 'any' },
    { label: 'Under 30 min', value: 'short' },
    { label: '30-120 min', value: 'standard' },
    { label: 'Over 120 min', value: 'long' },
] as const;
