import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import { DiscoverRestControllerService, MoviePage, TvSeriesPage } from '../../api';
import { toCardItem } from '../mappers/content-items.mapper';
import type { CardItem } from '../models/content-items.model';
import type { TmdbDiscoverQuery } from '../models/tmdb-discover-query.model';
import { interleave } from '../utils/interleave';
import { serializeNumberListParam } from '../utils/route-utils';
import { toTmdbMovieDiscoverSort, toTmdbTvDiscoverSort } from '../utils/tmdb-discover-sort';
import { LocaleStoreService } from './locale-store.service';

export const DISCOVER_PREVIEW_COUNT = 3;

/** Turns discover queries into TMDb requests, so every feature filters titles the same way. */
@Injectable({ providedIn: 'root' })
export class TmdbDiscoverService {
    constructor(
        private discoverRestControllerService: DiscoverRestControllerService,
        private localeStoreService: LocaleStoreService,
    ) {}

    /** One page of TMDb results; callers map the items for their own view. */
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

    /** Up to three titles with posters, alternating between the queries' first pages. */
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
