import type { TmdbDiscoverSortKey } from '../models/tmdb-discover-query.model';
import type { MediaType, SelectOption, SortDirection } from '../types';

export const DEFAULT_TMDB_DISCOVER_SORT_KEY: TmdbDiscoverSortKey = 'popularity';
export const DEFAULT_TMDB_DISCOVER_SORT_DIRECTION: SortDirection = 'desc';

const TMDB_DISCOVER_MOVIE_SORT_OPTIONS: readonly SelectOption<TmdbDiscoverSortKey>[] = [
    { label: 'Popularity', value: 'popularity' },
    { label: 'Rating', value: 'rating' },
    { label: 'Release date', value: 'release_date' },
    { label: 'Title', value: 'title' },
    { label: 'Vote count', value: 'vote_count' },
];

const TMDB_DISCOVER_TV_SORT_OPTIONS: readonly SelectOption<TmdbDiscoverSortKey>[] = [
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

// The generated discover clients accept only these literal `field.direction` values, not any string.
type TmdbMovieDiscoverSort = `${(typeof TMDB_MOVIE_DISCOVER_SORT_FIELDS)[TmdbDiscoverSortKey]}.${SortDirection}`;
type TmdbTvDiscoverSort = `${(typeof TMDB_TV_DISCOVER_SORT_FIELDS)[TmdbDiscoverSortKey]}.${SortDirection}`;

export const getTmdbDiscoverSortOptions = (mediaType: MediaType): readonly SelectOption<TmdbDiscoverSortKey>[] =>
    mediaType === 'movie' ? TMDB_DISCOVER_MOVIE_SORT_OPTIONS : TMDB_DISCOVER_TV_SORT_OPTIONS;

export const toTmdbMovieDiscoverSort = (sortKey: TmdbDiscoverSortKey, direction: SortDirection): TmdbMovieDiscoverSort =>
    `${TMDB_MOVIE_DISCOVER_SORT_FIELDS[sortKey]}.${direction}`;

export const toTmdbTvDiscoverSort = (sortKey: TmdbDiscoverSortKey, direction: SortDirection): TmdbTvDiscoverSort =>
    `${TMDB_TV_DISCOVER_SORT_FIELDS[sortKey]}.${direction}`;
