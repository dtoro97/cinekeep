import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import { DiscoverRestControllerService, MoviePage, TvSeriesPage } from '../../api';
import { toCardItem, toMediaListItem } from '../mappers/content-items.mapper';
import type { CardItem } from '../models/content-items.model';
import type { StreamingBaseQuery, StreamingDatePreset } from '../models/streaming-browse.model';
import type { MediaType } from '../types/media.types';
import type { SortDirection } from '../types/sort.types';
import { getCurrentMonthDateWindow, toISODate } from '../utils/get-iso-date';
import { isDefined } from '../utils/is-defined';
import { serializeNumberListParam } from '../utils/route-utils';
import {
    TmdbDiscoverSortKey,
    toTmdbMovieDiscoverSort,
    toTmdbTvDiscoverSort,
} from '../utils/tmdb-discover-sort';
import { LocaleStoreService } from './locale-store.service';

const PREVIEW_COUNT = 3;

@Injectable({ providedIn: 'root' })
export class StreamingQueryService {
    constructor(
        private discoverRestControllerService: DiscoverRestControllerService,
        private localeStoreService: LocaleStoreService,
    ) {}

    /** Up to three titles with posters, alternating between the query's media types. */
    preview$(query: StreamingBaseQuery): Observable<CardItem[]> {
        const groups$ = query.mediaTypes.map((mediaType) =>
            (mediaType === 'movie'
                ? this.discoverMovies$(query, query.sortBy, 'desc', 1).pipe(
                      map(({ results }) => (results ?? []).map((item) => toCardItem(item, 'movie'))),
                  )
                : this.discoverTv$(query, query.sortBy, 'desc', 1).pipe(
                      map(({ results }) => (results ?? []).map((item) => toCardItem(item, 'tv'))),
                  )
            ).pipe(
                map((previews) => previews.filter((preview) => !!preview.id && !!preview.imagePath)),
                // Previews only decorate the cards, which show placeholders without them.
                catchError(() => of<CardItem[]>([])),
            ),
        );

        return forkJoin(groups$).pipe(
            map((groups) =>
                Array.from({ length: Math.max(0, ...groups.map((group) => group.length)) })
                    .flatMap((_, index) => groups.map((group) => group[index]).filter(isDefined))
                    .slice(0, PREVIEW_COUNT),
            ),
        );
    }

    list$(
        query: StreamingBaseQuery,
        mediaType: MediaType,
        sortKey: TmdbDiscoverSortKey,
        direction: SortDirection,
        page: number,
    ) {
        const response$: Observable<MoviePage | TvSeriesPage> =
            mediaType === 'movie'
                ? this.discoverMovies$(query, sortKey, direction, page)
                : this.discoverTv$(query, sortKey, direction, page);

        return response$.pipe(
            map((response) => ({
                items: (response.results ?? []).map((item) => toMediaListItem(item, mediaType)),
                page: response.page ?? page,
                totalPages: response.total_pages ?? 0,
                totalResults: response.total_results ?? 0,
            })),
        );
    }

    private discoverMovies$(
        query: StreamingBaseQuery,
        sortKey: TmdbDiscoverSortKey,
        direction: SortDirection,
        page: number,
    ): Observable<MoviePage> {
        const dateWindow = toDateWindow(query.datePreset);
        const filtersByRelease = dateWindow.from || dateWindow.to || query.releaseType;

        return this.discoverRestControllerService.discoverMovie({
            ...this.toCommonParams(query),
            page,
            sortBy: toTmdbMovieDiscoverSort(sortKey, direction),
            primaryReleaseDateGte: dateWindow.from,
            primaryReleaseDateLte: dateWindow.to,
            region: filtersByRelease ? this.localeStoreService.region() : undefined,
            withReleaseType: query.releaseType ? Number(query.releaseType) : undefined,
        });
    }

    private discoverTv$(
        query: StreamingBaseQuery,
        sortKey: TmdbDiscoverSortKey,
        direction: SortDirection,
        page: number,
    ): Observable<TvSeriesPage> {
        const dateWindow = toDateWindow(query.datePreset);

        return this.discoverRestControllerService.discoverTv({
            ...this.toCommonParams(query),
            page,
            sortBy: toTmdbTvDiscoverSort(sortKey, direction),
            airDateGte: dateWindow.from,
            airDateLte: dateWindow.to,
        });
    }

    private toCommonParams(query: StreamingBaseQuery) {
        const filtersByProvider = query.providerId || query.providerIds?.length || query.monetization;

        return {
            includeAdult: false,
            voteAverageGte: query.voteAverageMin,
            voteCountGte: query.voteCountMin,
            voteCountLte: query.voteCountMax,
            watchRegion: filtersByProvider ? this.localeStoreService.region() : undefined,
            withGenres: serializeNumberListParam(query.genreIds) ?? undefined,
            withoutGenres: serializeNumberListParam(query.excludedGenreIds) ?? undefined,
            withKeywords: serializeNumberListParam(query.keywordIds) ?? undefined,
            withOriginCountry: query.originCountry,
            withOriginalLanguage: query.originalLanguage,
            withRuntimeLte: query.runtimeMax,
            withWatchMonetizationTypes: query.monetization,
            withWatchProviders: query.providerId
                ? `${query.providerId}`
                : (serializeNumberListParam(query.providerIds, '|') ?? undefined),
        };
    }
}

function toDateWindow(preset: StreamingDatePreset | undefined): { from?: string; to?: string } {
    if (!preset) {
        return {};
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (preset) {
        case 'today':
            return { from: toISODate(now), to: toISODate(now) };
        case 'current-season': {
            const seasonStartMonth = Math.floor(month / 3) * 3;
            return {
                from: toISODate(new Date(year, seasonStartMonth, 1)),
                to: toISODate(new Date(year, seasonStartMonth + 3, 0)),
            };
        }
        case 'current-two-months':
            return { from: toISODate(new Date(year, month, 1)), to: toISODate(new Date(year, month + 2, 0)) };
        default:
            return getCurrentMonthDateWindow(now);
    }
}
