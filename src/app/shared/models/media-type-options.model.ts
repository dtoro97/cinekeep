import type { MediaOrPersonFilterType, MediaOrPersonType, MediaType, SelectOption } from '../types';

export const MEDIA_TYPE_OPTION: Readonly<Record<MediaType, SelectOption<MediaType>>> = {
    movie: { label: 'Movies', value: 'movie' },
    tv: { label: 'TV series', value: 'tv' },
};

export const MEDIA_TYPE_OPTIONS: readonly SelectOption<MediaType>[] = [MEDIA_TYPE_OPTION.movie, MEDIA_TYPE_OPTION.tv];

/** What a single title or person is, for badges and meta lines ("Movie", not the filter's "Movies"). */
export const MEDIA_TYPE_LABEL: Readonly<Record<MediaOrPersonType, string>> = {
    movie: 'Movie',
    tv: 'TV series',
    person: 'Person',
};

/** Search filters: everything, one media type, or people. */
export const SEARCH_TYPE_OPTIONS: readonly SelectOption<MediaOrPersonFilterType>[] = [
    { label: 'All', value: 'all' },
    ...MEDIA_TYPE_OPTIONS,
    { label: 'People', value: 'person' },
];
