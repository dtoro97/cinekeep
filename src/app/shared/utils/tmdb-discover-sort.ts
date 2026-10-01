import type { MediaType, SelectOption, SortDirection } from '../types';

export const TMDB_DISCOVER_SORT_KEYS = [
    'popularity',
    'rating',
    'release_date',
    'title',
    'vote_count',
] as const;

export type TmdbDiscoverSortKey = (typeof TMDB_DISCOVER_SORT_KEYS)[number];

export type TmdbDiscoverSortOption = SelectOption<TmdbDiscoverSortKey>;

export const TMDB_DISCOVER_SORT_DIRECTIONS: readonly SortDirection[] = [
    'asc',
    'desc',
];

export const DEFAULT_TMDB_DISCOVER_SORT_KEY: TmdbDiscoverSortKey = 'popularity';
export const DEFAULT_TMDB_DISCOVER_SORT_DIRECTION: SortDirection = 'desc';

export const TMDB_DISCOVER_MOVIE_SORT_OPTIONS: readonly TmdbDiscoverSortOption[] = [
    { label: 'Popularity', value: 'popularity' },
    { label: 'Rating', value: 'rating' },
    { label: 'Release date', value: 'release_date' },
    { label: 'Title', value: 'title' },
    { label: 'Vote count', value: 'vote_count' },
];

export const TMDB_DISCOVER_TV_SORT_OPTIONS: readonly TmdbDiscoverSortOption[] = [
    { label: 'Popularity', value: 'popularity' },
    { label: 'Rating', value: 'rating' },
    { label: 'First air date', value: 'release_date' },
    { label: 'Series title', value: 'title' },
    { label: 'Vote count', value: 'vote_count' },
];

const TMDB_MOVIE_DISCOVER_SORT_FIELDS = {
    popularity: 'popularity',
    rating: 'vote_average',
    release_date: 'primary_release_date',
    title: 'title',
    vote_count: 'vote_count',
} as const satisfies Record<TmdbDiscoverSortKey, string>;

const TMDB_TV_DISCOVER_SORT_FIELDS = {
    popularity: 'popularity',
    rating: 'vote_average',
    release_date: 'first_air_date',
    title: 'name',
    vote_count: 'vote_count',
} as const satisfies Record<TmdbDiscoverSortKey, string>;

export type TmdbMovieDiscoverSort =
    `${(typeof TMDB_MOVIE_DISCOVER_SORT_FIELDS)[TmdbDiscoverSortKey]}.${SortDirection}`;

export type TmdbTvDiscoverSort =
    `${(typeof TMDB_TV_DISCOVER_SORT_FIELDS)[TmdbDiscoverSortKey]}.${SortDirection}`;

export function isTmdbDiscoverSortKey(value: unknown): value is TmdbDiscoverSortKey {
    return (
        typeof value === 'string' &&
        (TMDB_DISCOVER_SORT_KEYS as readonly string[]).includes(value)
    );
}

export function getTmdbDiscoverSortOptions(
    mediaType: MediaType,
): readonly TmdbDiscoverSortOption[] {
    return mediaType === 'movie'
        ? TMDB_DISCOVER_MOVIE_SORT_OPTIONS
        : TMDB_DISCOVER_TV_SORT_OPTIONS;
}

export const toTmdbMovieDiscoverSort = (sortKey: TmdbDiscoverSortKey, direction: SortDirection): TmdbMovieDiscoverSort =>
    `${TMDB_MOVIE_DISCOVER_SORT_FIELDS[sortKey]}.${direction}`;

export const toTmdbTvDiscoverSort = (sortKey: TmdbDiscoverSortKey, direction: SortDirection): TmdbTvDiscoverSort =>
    `${TMDB_TV_DISCOVER_SORT_FIELDS[sortKey]}.${direction}`;
