import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { DiscoverRestControllerService, MoviePage, MovieRestControllerService, TvSeriesPage } from '../../api';
import { toCardItem } from '../mappers/content-items.mapper';
import type { CardItem } from '../models/content-items.model';
import type { TmdbDateRange, TmdbDiscoverQuery } from '../models/tmdb-discover-query.model';
import { interleave } from '../utils/interleave';
import { serializeNumberListParam } from '../utils/route-utils';
import { toTmdbMovieDiscoverSort, toTmdbTvDiscoverSort } from '../utils/tmdb-discover-sort';
import { LocaleStoreService } from './locale-store.service';

export const DISCOVER_PREVIEW_COUNT = 3;
// A two-week window of openings fits in two or three pages; this only guards against a runaway query.
const OPENINGS_MAX_PAGES = 5;

// Turns discover queries into TMDb requests, so every feature filters titles the same way.
@Injectable({ providedIn: 'root' })
export class TmdbDiscoverService {
    constructor(
        private discoverRestControllerService: DiscoverRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private localeStoreService: LocaleStoreService,
    ) {}

    // One page of TMDb results; callers map the items for their own view.
    discover$(query: TmdbDiscoverQuery): Observable<MoviePage | TvSeriesPage> {
        const watchRegion = query.watchRegion || this.localeStoreService.region();
        const providers = serializeNumberListParam(query.providerIds, '|') ?? undefined;
        const { releaseDates, firstReleaseDates } = query;
        const commonParams = {
            includeAdult: false,
            page: query.page ?? 1,
            voteAverageGte: query.voteAverageMin ?? undefined,
            voteCountGte: query.voteCountMin ?? undefined,
            voteCountLte: query.voteCountMax,
            watchRegion: providers || query.monetization ? watchRegion : undefined,
            withCompanies: serializeNumberListParam(query.companyIds, '|') ?? undefined,
            withGenres: serializeNumberListParam(query.genreIds) ?? undefined,
            withKeywords: serializeNumberListParam(query.keywordIds) ?? undefined,
            withOriginCountry: query.originCountry,
            withOriginalLanguage: query.originalLanguage ?? undefined,
            withRuntimeGte: query.runtimeMin,
            withRuntimeLte: query.runtimeMax,
            withWatchMonetizationTypes: query.monetization,
            withWatchProviders: providers,
            withoutGenres: serializeNumberListParam(query.excludedGenreIds) ?? undefined,
        };

        if (query.mediaType === 'tv') {
            return this.discoverRestControllerService.discoverTv({
                ...commonParams,
                airDateGte: releaseDates?.from,
                airDateLte: releaseDates?.to,
                firstAirDateGte: firstReleaseDates?.from,
                firstAirDateLte: firstReleaseDates?.to,
                sortBy: toTmdbTvDiscoverSort(query.sortKey, query.sortDirection),
                timezone: query.timezone,
            });
        }

        const filtersByRelease =
            releaseDates?.from ||
            releaseDates?.to ||
            firstReleaseDates?.from ||
            firstReleaseDates?.to ||
            query.releaseType;

        return this.discoverRestControllerService.discoverMovie({
            ...commonParams,
            certification: query.certification ?? undefined,
            certificationCountry: query.certification ? watchRegion : undefined,
            primaryReleaseDateGte: firstReleaseDates?.from,
            primaryReleaseDateLte: firstReleaseDates?.to,
            region: filtersByRelease ? watchRegion : undefined,
            releaseDateGte: releaseDates?.from,
            releaseDateLte: releaseDates?.to,
            sortBy: toTmdbMovieDiscoverSort(query.sortKey, query.sortDirection),
            withReleaseType: query.releaseType ?? undefined,
        });
    }

    // Every movie opening in the watch region between the release dates, each on the day it opens there, earliest
    // first. TMDb results only carry the first release anywhere (a re-release keeps its original year) and page by
    // it, so the whole window is loaded and each movie's regional date is looked up.
    openings$(
        query: Omit<TmdbDiscoverQuery, 'mediaType' | 'page' | 'releaseDates' | 'firstReleaseDates'> & {
            readonly releaseDates: Required<TmdbDateRange>;
        },
    ) {
        const region = query.watchRegion || this.localeStoreService.region();
        const { from, to } = query.releaseDates;
        const movieQuery = { ...query, mediaType: 'movie' as const };

        return this.discover$(movieQuery).pipe(
            switchMap((firstPage) => {
                const otherPages = Array.from(
                    { length: Math.min(firstPage.total_pages ?? 1, OPENINGS_MAX_PAGES) - 1 },
                    (_, index) =>
                        this.discover$({ ...movieQuery, page: index + 2 }).pipe(
                            // A failed later page leaves its movies out instead of failing the whole window.
                            catchError(() => of<MoviePage>({ results: [] })),
                        ),
                );

                return otherPages.length
                    ? forkJoin(otherPages).pipe(map((pages) => [firstPage, ...pages]))
                    : of([firstPage]);
            }),
            switchMap((pages) => {
                const movies = pages
                    .flatMap(({ results }) => results ?? [])
                    .flatMap((item) => (item.id ? [{ id: item.id, item }] : []))
                    .filter(({ id }, index, all) => all.findIndex((other) => other.id === id) === index);

                return movies.length
                    ? forkJoin(
                          movies.map(({ id, item }) => {
                              // TMDb also matches some movies that list no regional release of the type; those open
                              // on their first release, when it falls in the window.
                              const firstRelease = toCardItem(item, 'movie').date;
                              const fallbackDate = firstRelease >= from && firstRelease <= to ? firstRelease : null;

                              return this.movieRestControllerService.movieReleaseDates({ movieId: id }).pipe(
                                  map(({ results }) => ({
                                      item,
                                      openingDate:
                                          (results ?? [])
                                              .find(({ iso_3166_1 }) => iso_3166_1 === region)
                                              ?.release_dates?.filter(
                                                  ({ type }) => !query.releaseType || type === query.releaseType,
                                              )
                                              .map(({ release_date }) => release_date?.slice(0, 10) ?? '')
                                              .filter((date) => date >= from && date <= to)
                                              .sort()[0] ?? fallbackDate,
                                  })),
                                  // Without its regional dates a movie falls back to its first release as well.
                                  catchError(() => of({ item, openingDate: fallbackDate })),
                              );
                          }),
                      )
                    : of([]);
            }),
            // A stable sort keeps the query's order within a day; movies without a regional date sort with the last day.
            map((openings) =>
                [...openings].sort((left, right) => (left.openingDate ?? to).localeCompare(right.openingDate ?? to)),
            ),
        );
    }

    // Up to three titles with posters, alternating between the queries' first pages.
    preview$(queries: readonly TmdbDiscoverQuery[]): Observable<CardItem[]> {
        return forkJoin(
            queries.map((query) =>
                this.discover$(query).pipe(
                    map(({ results }) =>
                        (results ?? [])
                            .map((item) => toCardItem(item, query.mediaType))
                            .filter(({ id, imagePath }) => !!id && !!imagePath),
                    ),
                    // Previews only decorate the cards, which show placeholders without them.
                    catchError(() => of<CardItem[]>([])),
                ),
            ),
        ).pipe(
            map((groups) => interleave(groups).slice(0, DISCOVER_PREVIEW_COUNT)),
        );
    }
}
