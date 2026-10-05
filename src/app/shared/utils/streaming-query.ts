import { CURATED_TV_EXCLUDED_GENRE_IDS } from '../../constants';
import type { StreamingBaseQuery, StreamingDatePreset } from '../models/streaming-query.model';
import type { TmdbDateRange, TmdbDiscoverQuery, TmdbDiscoverSortKey } from '../models/tmdb-discover-query.model';
import { TOP_PROVIDER_COUNT, type WatchProviderOption } from '../models/watch-provider.model';
import type { MediaType } from '../types/media.types';
import type { SortDirection } from '../types/sort.types';
import { getCurrentMonthDateWindow, toISODate } from './get-iso-date';

const STREAMING_DATE_WINDOWS: Record<StreamingDatePreset, (now: Date) => TmdbDateRange> = {
    today: (now) => ({ from: toISODate(now), to: toISODate(now) }),
    'current-month': (now) => getCurrentMonthDateWindow(now),
    'current-season': (now) => {
        const seasonStartMonth = Math.floor(now.getMonth() / 3) * 3;

        return {
            from: toISODate(new Date(now.getFullYear(), seasonStartMonth, 1)),
            to: toISODate(new Date(now.getFullYear(), seasonStartMonth + 3, 0)),
        };
    },
    'current-two-months': (now) => ({
        from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toISODate(new Date(now.getFullYear(), now.getMonth() + 2, 0)),
    }),
};

/** The TMDb request behind a streaming list, for one of its media types. */
export const toStreamingDiscoverQuery = (
    query: StreamingBaseQuery,
    mediaType: MediaType,
    sortKey: TmdbDiscoverSortKey = query.sortBy,
    sortDirection: SortDirection = 'desc',
    page = 1,
): TmdbDiscoverQuery => {
    const window = query.datePreset ? STREAMING_DATE_WINDOWS[query.datePreset](new Date()) : undefined;

    return {
        mediaType,
        sortKey,
        sortDirection,
        page,
        genreIds: query.genreIds,
        excludedGenreIds: query.excludedGenreIds,
        keywordIds: query.keywordIds,
        providerIds: query.providerIds,
        monetization: query.monetization,
        originalLanguage: query.originalLanguage,
        originCountry: query.originCountry,
        runtimeMax: query.runtimeMax,
        voteAverageMin: query.voteAverageMin,
        voteCountMin: query.voteCountMin,
        voteCountMax: query.voteCountMax,
        // Movies count from their first release, TV series from the episodes airing in the window.
        ...(mediaType === 'movie' ? { firstReleaseDates: window } : { releaseDates: window }),
    };
};

/** One preview request per media type the list covers. */
export const toStreamingPreviewQueries = (query: StreamingBaseQuery): TmdbDiscoverQuery[] =>
    query.mediaTypes.map((mediaType) => toStreamingDiscoverQuery(query, mediaType));

/** "This month": TV series with episodes this month on the region's top providers, once they are known. */
export const toStreamingThisMonthQuery = (tvProviders: readonly WatchProviderOption[]): StreamingBaseQuery => ({
    mediaTypes: ['tv'],
    providerIds: tvProviders.slice(0, TOP_PROVIDER_COUNT).map((provider) => provider.id),
    monetization: 'flatrate',
    datePreset: 'current-month',
    // Daily talk, news, reality and soap episodes would otherwise crowd out the premieres.
    excludedGenreIds: CURATED_TV_EXCLUDED_GENRE_IDS,
    sortBy: 'popularity',
});
