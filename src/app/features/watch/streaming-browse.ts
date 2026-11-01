import {
    getCurrentMonthName,
    STREAMING_THIS_MONTH_SLUG,
    StreamingBaseQuery,
    toStreamingThisMonthQuery,
} from '../../shared';

export interface StreamingEditorialSection {
    readonly slug: string;
    readonly title: string;
    readonly description: string;
    readonly baseQuery: StreamingBaseQuery;
}

export const AIRING_TODAY_SLUG = 'airing-today';

export const getStreamingThisMonthTitle = (): string => `Streaming in ${getCurrentMonthName()}`;

// Its list waits for the region's providers and then uses `toStreamingThisMonthQuery(providers)`.
export const STREAMING_THIS_MONTH_SECTION: StreamingEditorialSection = {
    slug: STREAMING_THIS_MONTH_SLUG,
    title: "This month's streaming arrivals",
    description: 'New series and new seasons arriving on the major streaming services this month.',
    baseQuery: toStreamingThisMonthQuery([]),
};

export const STREAMING_EDITORIAL_SECTIONS: readonly StreamingEditorialSection[] = [
    STREAMING_THIS_MONTH_SECTION,
    {
        slug: AIRING_TODAY_SLUG,
        title: 'Airing today',
        description: 'Popular TV series with a new episode out today.',
        baseQuery: {
            mediaTypes: ['tv'],
            datePreset: 'today',
            sortBy: 'popularity',
        },
    },
    {
        slug: 'anime-premieres',
        title: 'Japanese animation premieres',
        description: 'Japanese animated series that started this season, most popular first.',
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
        title: 'Movies under 100 minutes',
        description: 'Popular movies on subscription services that run 100 minutes or less.',
        baseQuery: {
            mediaTypes: ['movie'],
            monetization: 'flatrate',
            runtimeMax: 100,
            sortBy: 'popularity',
        },
    },
    {
        slug: 'hidden-streaming-gems',
        title: 'Highly rated, little seen',
        description: 'Movies and TV series scored 7.5 or higher by fewer than 1,000 voters.',
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
