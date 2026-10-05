import { getCurrentMonthName, MediaType, TmdbDiscoverSortKey, WatchProviderOption } from '../../shared';

export type StreamingDatePreset = 'today' | 'current-month' | 'current-season' | 'current-two-months';
export type StreamingMonetizationType = 'ads' | 'buy' | 'flatrate' | 'free' | 'rent';

export interface StreamingBaseQuery {
    readonly mediaTypes: readonly MediaType[];
    readonly providerId?: number;
    readonly providerIds?: readonly number[];
    readonly monetization?: StreamingMonetizationType;
    readonly genreIds?: readonly number[];
    readonly keywordIds?: readonly number[];
    readonly originalLanguage?: string;
    readonly originCountry?: string;
    readonly datePreset?: StreamingDatePreset;
    readonly releaseType?: string;
    readonly runtimeMax?: number;
    readonly voteAverageMin?: number;
    readonly voteCountMin?: number;
    readonly voteCountMax?: number;
    readonly sortBy: TmdbDiscoverSortKey;
}

export interface StreamingEditorialSection {
    readonly slug: string;
    readonly title: string;
    readonly description: string;
    readonly ctaLabel: string;
    readonly baseQuery: StreamingBaseQuery;
}

export const STREAMING_THIS_MONTH_SLUG = 'streaming-this-month';
export const AIRING_TODAY_SLUG = 'airing-today';

export const getStreamingThisMonthTitle = (): string => `Streaming in ${getCurrentMonthName()}`;

/** The "this month" list is narrowed to TV series on the region's top three providers once they are known. */
export const toStreamingThisMonthQuery = (
    section: StreamingEditorialSection,
    tvProviders: readonly WatchProviderOption[],
): StreamingBaseQuery => ({
    ...section.baseQuery,
    mediaTypes: ['tv'],
    providerIds: tvProviders.slice(0, 3).map((provider) => provider.id),
    sortBy: 'popularity',
});

export const STREAMING_EDITORIAL_SECTIONS: readonly StreamingEditorialSection[] = [
    {
        slug: STREAMING_THIS_MONTH_SLUG,
        title: "This month's streaming arrivals",
        description: 'Fresh premieres and returning seasons landing on major streaming services.',
        ctaLabel: 'Browse arrivals',
        baseQuery: {
            mediaTypes: ['movie', 'tv'],
            monetization: 'flatrate',
            datePreset: 'current-month',
            sortBy: 'release_date',
        },
    },
    {
        slug: AIRING_TODAY_SLUG,
        title: 'Airing today',
        description: 'Popular TV series with episodes scheduled today.',
        ctaLabel: "See today's TV series",
        baseQuery: {
            mediaTypes: ['tv'],
            datePreset: 'today',
            sortBy: 'popularity',
        },
    },
    {
        slug: 'anime-premieres',
        title: 'Japanese animation premieres',
        description: 'New and popular animated series from Japan, grouped by current season.',
        ctaLabel: 'Find anime premieres',
        baseQuery: {
            mediaTypes: ['tv'],
            genreIds: [16],
            originalLanguage: 'ja',
            datePreset: 'current-season',
            sortBy: 'popularity',
        },
    },
    {
        slug: 'short-streaming-movies',
        title: 'Short watches for movie night',
        description: 'Streaming movies with lean runtimes for an easier movie night.',
        ctaLabel: 'See short movies',
        baseQuery: {
            mediaTypes: ['movie'],
            monetization: 'flatrate',
            runtimeMax: 100,
            sortBy: 'popularity',
        },
    },
    {
        slug: 'hidden-streaming-gems',
        title: 'Under-the-radar streaming',
        description: 'Movies and TV series with strong scores outside the obvious crowd favorites.',
        ctaLabel: 'Browse under-the-radar titles',
        baseQuery: {
            mediaTypes: ['movie', 'tv'],
            monetization: 'flatrate',
            voteAverageMin: 7.5,
            voteCountMin: 200,
            voteCountMax: 1000,
            sortBy: 'rating',
        },
    },
];
