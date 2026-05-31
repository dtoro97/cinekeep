import { Injectable } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, combineLatest, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { PAGE_SIZE } from '../../../constants';
import {
    DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    DEFAULT_TMDB_DISCOVER_SORT_KEY,
    getTmdbDiscoverSortOptions,
    parseEnumParam,
    RemoteData,
    MediaListItem,
    MediaType,
    ToggleGroupOption,
    SortDirection,
    TMDB_DISCOVER_SORT_DIRECTIONS,
    TMDB_DISCOVER_SORT_KEYS,
    WatchProviderOption,
    WatchProviderStoreService,
} from '../../../shared';
import {
    StreamingBaseQuery,
    StreamingEditorialSection,
    StreamingListResult,
    StreamingSortKey,
} from '../models/streaming-browse.models';
import { StreamingQueryService } from '../services/streaming-query.service';
import {
    AIRING_TODAY_SLUG,
    STREAMING_EDITORIAL_SECTIONS,
    STREAMING_THIS_MONTH_SLUG,
    getStreamingThisMonthTitle,
} from '../streaming/streaming-browse.config';

interface StreamingListContext {
    readonly key: string;
    readonly title: string;
    readonly description: string;
    readonly baseQuery: StreamingBaseQuery;
    readonly providerName?: string;
}

interface StreamingListRequest {
    readonly context: StreamingListContext | null;
    readonly pendingProvider: boolean;
    readonly mediaType: MediaType;
    readonly sortKey: StreamingSortKey;
    readonly sortDirection: SortDirection;
}

interface StreamingListPagination {
    readonly page: number;
    readonly totalPages: number;
}

interface StreamingListState {
    readonly context: StreamingListContext | null;
    readonly mediaType: MediaType;
    readonly sortKey: StreamingSortKey;
    readonly sortDirection: SortDirection;
    readonly pagination: StreamingListPagination;
    readonly totalResults: number;
    readonly resultsState: RemoteData<MediaListItem[]>;
}

interface StreamingListDisplayItem {
    readonly item: MediaListItem;
    readonly index: number;
    readonly routerLink: (string | number)[];
    readonly availabilityText: string;
}

const EMPTY_PAGINATION: StreamingListPagination = {
    page: 0,
    totalPages: 0,
};

const INITIAL_STATE: StreamingListState = {
    context: null,
    mediaType: 'tv',
    sortKey: DEFAULT_TMDB_DISCOVER_SORT_KEY,
    sortDirection: DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    pagination: { ...EMPTY_PAGINATION },
    totalResults: 0,
    resultsState: { state: 'notAsked' },
};

const MEDIA_TYPE_OPTIONS: Record<MediaType, ToggleGroupOption> = {
    movie: { label: 'Movies', value: 'movie' },
    tv: { label: 'TV series', value: 'tv' },
};

@Injectable()
export class StreamingListStoreService extends ComponentStore<StreamingListState> {
    readonly vm$ = this.select((state) => {
        const visibleCount = this.getVisibleCount(state.resultsState);
        const hasResults = state.resultsState.state === 'success' || state.resultsState.state === 'loading-more';

        return {
            title: state.context?.title ?? '',
            description: state.context?.description ?? '',
            resultsState: state.resultsState,
            mediaType: state.mediaType,
            mediaTypeOptions: this.getMediaTypeOptions(state.context),
            showMediaTypeToggle:
                this.getMediaTypeOptions(state.context).length > 1,
            sortKey: state.sortKey,
            sortDirection: state.sortDirection,
            sortOptions: this.getSortOptions(state.mediaType),
            visibleCount,
            totalResults: state.totalResults,
            showResultCount: hasResults,
            hasMore: hasResults && state.pagination.page < state.pagination.totalPages,
            showEmptyState: state.resultsState.state === 'success' && visibleCount === 0,
            isLoading: state.resultsState.state === 'loading',
            loadingMorePlaceholderCount:
                state.resultsState.state === 'loading-more' ? state.resultsState.data.length : 0,
            displayItems: this.toDisplayItems(state.resultsState, state.context, state.mediaType),
        };
    });

    private readonly requestEffect = this.effect<StreamingListRequest>((request$) =>
        request$.pipe(switchMap((request) => this.handleRouteRequest(request))),
    );

    private readonly loadMoreEffect = this.effect<void>((trigger$) =>
        trigger$.pipe(switchMap(() => this.handleLoadMoreRequest())),
    );

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly streamingQuery: StreamingQueryService,
        private readonly watchProviderStore: WatchProviderStoreService,
    ) {
        super(INITIAL_STATE);
        this.requestEffect(this.routeRequest$());
    }

    loadMore(): void {
        this.loadMoreEffect();
    }

    updateSort(value: unknown): void {
        const sortKey = this.normalizeSortKey(value, this.get().sortKey);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { sort: sortKey },
            queryParamsHandling: 'merge',
        });
    }

    toggleSortDirection(): void {
        const nextDirection = this.get().sortDirection === 'asc' ? 'desc' : 'asc';

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { direction: nextDirection },
            queryParamsHandling: 'merge',
        });
    }

    updateMediaType(value: unknown): void {
        const state = this.get();
        const mediaType = this.normalizeMediaType(
            value,
            state.mediaType,
            state.context?.baseQuery,
        );

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { type: mediaType },
            queryParamsHandling: 'merge',
        });
    }

    private routeRequest$(): Observable<StreamingListRequest> {
        return combineLatest({
            params: this.route.paramMap,
            data: this.route.data,
            queryParams: this.route.queryParamMap,
            providersLoaded: this.watchProviderStore.loaded$,
            movieProviders: this.watchProviderStore.movieProviders$,
            tvProviders: this.watchProviderStore.tvProviders$,
        }).pipe(
            map((source) => this.toRequest(source)),
            distinctUntilChanged(
                (previous, current) =>
                    previous.context?.key === current.context?.key &&
                    previous.pendingProvider === current.pendingProvider &&
                    previous.mediaType === current.mediaType &&
                    previous.sortKey === current.sortKey &&
                    previous.sortDirection === current.sortDirection,
            ),
        );
    }

    private toRequest(source: {
        readonly params: ParamMap;
        readonly data: Record<string, unknown>;
        readonly queryParams: ParamMap;
        readonly providersLoaded: boolean;
        readonly movieProviders: readonly WatchProviderOption[];
        readonly tvProviders: readonly WatchProviderOption[];
    }): StreamingListRequest {
        const listSlug = source.params.get('listSlug');
        const needsProviders =
            source.data['streamingListKind'] === 'provider' ||
            listSlug === STREAMING_THIS_MONTH_SLUG;
        const context = this.resolveContext(
            source.params,
            source.data,
            source.providersLoaded,
            source.movieProviders,
            source.tvProviders,
        );
        const baseQuery = context?.baseQuery;
        const fallbackSort = baseQuery?.sortBy ?? DEFAULT_TMDB_DISCOVER_SORT_KEY;
        const sortKey = this.normalizeSortKey(source.queryParams.get('sort'), fallbackSort);

        return {
            context,
            pendingProvider: needsProviders && !source.providersLoaded,
            mediaType: this.resolveMediaType(
                baseQuery,
                source.queryParams.get('type'),
            ),
            sortKey,
            sortDirection: parseEnumParam(
                source.queryParams.get('direction'),
                TMDB_DISCOVER_SORT_DIRECTIONS,
                DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
            ),
        };
    }

    private resolveContext(
        params: ParamMap,
        data: Record<string, unknown>,
        providersLoaded: boolean,
        movieProviders: readonly WatchProviderOption[],
        tvProviders: readonly WatchProviderOption[],
    ): StreamingListContext | null {
        if (data['streamingListKind'] === 'provider') {
            if (!providersLoaded) {
                return null;
            }

            const providerId = Number(params.get('providerId'));
            const provider = Number.isFinite(providerId)
                ? this.findProvider(providerId, movieProviders, tvProviders)
                : null;

            return provider
                ? {
                      key: `provider-${provider.id}`,
                      title: `Airing now on ${provider.name}`,
                      description: `Browse popular movies and TV series currently available through ${provider.name}.`,
                      providerName: provider.name,
                      baseQuery: {
                          mediaTypes: ['movie', 'tv'],
                          providerId: provider.id,
                          monetization: 'flatrate',
                          datePreset: 'current-month',
                          sortBy: 'popularity',
                      },
                  }
                : null;
        }

        const section = this.findEditorialSection(params.get('listSlug'));

        if (!section) {
            return null;
        }

        if (section.slug === STREAMING_THIS_MONTH_SLUG && !providersLoaded) {
            return null;
        }

        const baseQuery =
            section.slug === STREAMING_THIS_MONTH_SLUG
                ? {
                      ...section.baseQuery,
                      mediaTypes: ['tv'] as const,
                      providerIds: tvProviders.slice(0, 3).map((provider) => provider.id),
                      sortBy: 'popularity' as const,
                  }
                : section.baseQuery;

        return {
            key: section.slug,
            title:
                section.slug === STREAMING_THIS_MONTH_SLUG
                    ? getStreamingThisMonthTitle()
                    : section.title,
            description: section.description,
            baseQuery,
        };
    }

    private handleRouteRequest(request: StreamingListRequest): Observable<void> {
        if (!request.context) {
            if (!request.pendingProvider) {
                this.router.navigateByUrl('/not-found', { replaceUrl: true });
                return EMPTY;
            }

            this.patchState({
                context: null,
                mediaType: request.mediaType,
                sortKey: request.sortKey,
                sortDirection: request.sortDirection,
                pagination: { ...EMPTY_PAGINATION },
                totalResults: 0,
                resultsState: { state: 'loading' },
            });
            return of(undefined);
        }

        this.patchState({
            context: request.context,
            mediaType: request.mediaType,
            sortKey: request.sortKey,
            sortDirection: request.sortDirection,
            pagination: { ...EMPTY_PAGINATION },
            totalResults: 0,
            resultsState: { state: 'loading' },
        });

        return this.fetchPage$(request, 1);
    }

    private handleLoadMoreRequest(): Observable<void> {
        const state = this.get();

        if (
            !state.context ||
            state.resultsState.state !== 'success' ||
            state.pagination.page >= state.pagination.totalPages
        ) {
            return of(undefined);
        }

        this.patchState({
            resultsState: {
                state: 'loading-more',
                data: state.resultsState.data,            },
        });

        return this.fetchPage$(
            {
                context: state.context,
                pendingProvider: false,
                mediaType: state.mediaType,
                sortKey: state.sortKey,
                sortDirection: state.sortDirection,
            },
            state.pagination.page + 1,
        );
    }

    private fetchPage$(request: StreamingListRequest, page: number): Observable<void> {
        if (!request.context) {
            return of(undefined);
        }

        return this.streamingQuery
            .list$(request.context.baseQuery, request.mediaType, request.sortKey, request.sortDirection, page)
            .pipe(
                tap((result) => this.patchLoadedResults(result, page)),
                map(() => undefined),
                catchError(() => this.handleResultsError()),
            );
    }

    private patchLoadedResults(result: StreamingListResult, requestedPage: number): void {
        const currentState = this.get().resultsState;
        const currentItems = currentState.state === 'loading-more' ? currentState.data : [];

        this.patchState({
            pagination: {
                page: result.page || requestedPage,
                totalPages: result.totalPages,
            },
            totalResults: result.totalResults,
            resultsState: {
                state: 'success',
                data: requestedPage === 1 ? [...result.items] : [...currentItems, ...result.items],
            },
        });
    }

    private handleResultsError(): Observable<never> {
        const currentState = this.get().resultsState;
        this.patchState({
            resultsState: {
                state: 'success',
                data: currentState.state === 'loading-more' ? currentState.data : [],
            },
        });

        return EMPTY;
    }

    private resolveMediaType(
        query: StreamingBaseQuery | undefined,
        requestedType: string | null,
    ): MediaType {
        if (!query) {
            return 'tv';
        }

        const mediaType =
            requestedType === 'movie' || requestedType === 'tv'
                ? requestedType
                : null;

        if (mediaType && query.mediaTypes.includes(mediaType)) {
            return mediaType;
        }

        return query.mediaTypes.includes('tv') ? 'tv' : (query.mediaTypes[0] ?? 'movie');
    }

    private getVisibleCount(state: RemoteData<MediaListItem[]>): number {
        return state.state === 'success' || state.state === 'loading-more' ? state.data.length : 0;
    }

    private toDisplayItems(
        state: RemoteData<MediaListItem[]>,
        context: StreamingListContext | null,
        mediaType: MediaType,
    ): StreamingListDisplayItem[] {
        if (state.state !== 'success' && state.state !== 'loading-more') {
            return [];
        }

        return state.data.map((item, index) => ({
            item,
            index: index + 1,
            routerLink: ['/title', item.id, item.mediaType],
            availabilityText: this.toAvailabilityText(
                item,
                context,
                mediaType,
            ),
        }));
    }

    private toAvailabilityText(
        item: MediaListItem,
        context: StreamingListContext | null,
        mediaType: MediaType,
    ): string {
        const providerText = context?.providerName
            ? ` on ${context.providerName}`
            : '';

        if (mediaType === 'tv') {
            if (context?.key === AIRING_TODAY_SLUG) {
                return 'Airing today';
            }

            return `Streaming${providerText}`;
        }

        return item.date
            ? `Released ${this.formatDate(item.date)}${providerText}`
            : `Available${providerText}`;
    }

    private formatDate(date: string): string {
        return new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(date));
    }

    private getSortOptions(mediaType: MediaType) {
        return getTmdbDiscoverSortOptions(mediaType);
    }

    private getMediaTypeOptions(
        context: StreamingListContext | null,
    ): ToggleGroupOption[] {
        if (!context) {
            return [];
        }

        return context.baseQuery.mediaTypes
            .filter((mediaType): mediaType is MediaType =>
                mediaType === 'movie' || mediaType === 'tv',
            )
            .map((mediaType) => MEDIA_TYPE_OPTIONS[mediaType]);
    }

    private normalizeSortKey(value: unknown, fallback: StreamingSortKey): StreamingSortKey {
        return parseEnumParam(value, TMDB_DISCOVER_SORT_KEYS, fallback);
    }

    private normalizeMediaType(
        value: unknown,
        fallback: MediaType,
        query?: StreamingBaseQuery,
    ): MediaType {
        const mediaType = value === 'movie' || value === 'tv' ? value : fallback;

        return query?.mediaTypes.includes(mediaType) === false
            ? this.resolveMediaType(query, null)
            : mediaType;
    }

    private findEditorialSection(slug: string | null): StreamingEditorialSection | null {
        return STREAMING_EDITORIAL_SECTIONS.find((section) => section.slug === slug) ?? null;
    }

    private findProvider(
        providerId: number,
        movieProviders: readonly WatchProviderOption[],
        tvProviders: readonly WatchProviderOption[],
    ): WatchProviderOption | null {
        return [...movieProviders, ...tvProviders].find((provider) => provider.id === providerId) ?? null;
    }
}
