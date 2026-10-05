import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, combineLatest, distinctUntilChanged, EMPTY, map, Observable, switchMap, tap } from 'rxjs';

import {
    AIRING_TODAY_SLUG,
    DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    DEFAULT_TMDB_DISCOVER_SORT_KEY,
    getStreamingThisMonthTitle,
    getTmdbDiscoverSortOptions,
    MEDIA_TYPE_OPTION,
    MediaListItem,
    MediaStateLookup,
    MediaType,
    parseEnumParam,
    RemoteData,
    remoteData,
    SortDirection,
    STREAMING_EDITORIAL_SECTIONS,
    STREAMING_THIS_MONTH_SLUG,
    StreamingBaseQuery,
    StreamingQueryService,
    TMDB_DISCOVER_SORT_DIRECTIONS,
    TMDB_DISCOVER_SORT_KEYS,
    TmdbDiscoverSortKey,
    toLibraryState,
    toStreamingThisMonthQuery,
    UserLibraryService,
    WatchProviderStoreService,
} from '../../../shared';

interface StreamingListContext {
    readonly key: string;
    readonly title: string;
    readonly description: string;
    readonly baseQuery: StreamingBaseQuery;
    readonly providerName?: string;
}

interface StreamingListRequest {
    readonly context: StreamingListContext | null;
    readonly isWaitingForProviders: boolean;
    readonly mediaType: MediaType;
    readonly sortKey: TmdbDiscoverSortKey;
    readonly sortDirection: SortDirection;
}

interface StreamingListState {
    readonly context: StreamingListContext | null;
    readonly mediaType: MediaType;
    readonly sortKey: TmdbDiscoverSortKey;
    readonly sortDirection: SortDirection;
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
    readonly results: RemoteData<MediaListItem[]>;
    readonly libraryStates: MediaStateLookup | null;
}

const INITIAL_LOADING_ROWS = 20;

const RELEASE_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const INITIAL_STATE: StreamingListState = {
    context: null,
    mediaType: 'tv',
    sortKey: DEFAULT_TMDB_DISCOVER_SORT_KEY,
    sortDirection: DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    page: 0,
    totalPages: 0,
    totalResults: 0,
    results: { state: 'notAsked' },
    libraryStates: null,
};

@Injectable()
export class StreamingListStoreService extends ComponentStore<StreamingListState> {
    readonly streamingList$ = this.select(
        ({ context, mediaType, sortKey, sortDirection, page, totalPages, totalResults, results, libraryStates }) => {
            const items = remoteData(results, []);
            const hasResults = results.state === 'success' || results.state === 'loading-more';
            const mediaTypeOptions = (context?.baseQuery.mediaTypes ?? []).map((type) => MEDIA_TYPE_OPTION[type]);
            const providerText = context?.providerName ? ` on ${context.providerName}` : '';

            return {
                title: context?.title ?? '',
                description: context?.description ?? '',
                mediaType,
                mediaTypeOptions,
                showMediaTypeToggle: mediaTypeOptions.length > 1,
                sortKey,
                sortDirection,
                sortOptions: getTmdbDiscoverSortOptions(mediaType),
                totalResults,
                showResultCount: hasResults,
                hasMore: hasResults && page < totalPages,
                showEmptyState: results.state === 'success' && items.length === 0,
                skeletonCount:
                    results.state === 'loading'
                        ? INITIAL_LOADING_ROWS
                        : results.state === 'loading-more'
                          ? results.data.length
                          : 0,
                displayItems: items.map((item) => ({
                    item,
                    routerLink: ['/title', item.id, item.mediaType],
                    availabilityText:
                        mediaType === 'tv'
                            ? context?.key === AIRING_TODAY_SLUG
                                ? 'Airing today'
                                : `Streaming${providerText}`
                            : item.date
                              ? `Released ${RELEASE_DATE_FORMAT.format(new Date(item.date))}${providerText}`
                              : `Available${providerText}`,
                    libraryState: toLibraryState(libraryStates, item),
                })),
                seoImagePath: (items.find((item) => !!item.thumb) ?? items[0])?.thumb ?? null,
            };
        },
    );

    private readonly loadList = this.effect<StreamingListRequest>((request$) =>
        request$.pipe(
            switchMap(({ context, isWaitingForProviders, mediaType, sortKey, sortDirection }) => {
                if (!context && !isWaitingForProviders) {
                    this.router.navigateByUrl('/not-found', { replaceUrl: true });
                    return EMPTY;
                }

                this.patchState({
                    context,
                    mediaType,
                    sortKey,
                    sortDirection,
                    page: 0,
                    totalPages: 0,
                    totalResults: 0,
                    results: { state: 'loading' },
                });
                return this.fetchPage$(1);
            }),
        ),
    );

    private readonly setLibraryStates = this.effect<MediaStateLookup | null>((libraryStates$) =>
        libraryStates$.pipe(tap((libraryStates) => this.patchState({ libraryStates }))),
    );

    constructor(
        private activatedRoute: ActivatedRoute,
        private router: Router,
        private streamingQueryService: StreamingQueryService,
        watchProviderStoreService: WatchProviderStoreService,
        userLibraryService: UserLibraryService,
    ) {
        super(INITIAL_STATE);

        this.loadList(
            combineLatest({
                params: activatedRoute.paramMap,
                data: activatedRoute.data,
                queryParams: activatedRoute.queryParamMap,
                catalog: watchProviderStoreService.catalog$,
            }).pipe(
                map(({ params, data, queryParams, catalog }): StreamingListRequest => {
                    const isProviderList = data['streamingListKind'] === 'provider';
                    const section = STREAMING_EDITORIAL_SECTIONS.find(({ slug }) => slug === params.get('listSlug'));
                    const isThisMonthList = section?.slug === STREAMING_THIS_MONTH_SLUG;
                    const provider = [...catalog.movieProviders, ...catalog.tvProviders].find(
                        ({ id }) => id === Number(params.get('providerId')),
                    );
                    let context: StreamingListContext | null = null;

                    if (isProviderList && catalog.loaded && provider) {
                        context = {
                            key: `provider-${provider.id}`,
                            title: `Streaming on ${provider.name}`,
                            description: `Popular movies and TV series available with ${provider.name} in your region.`,
                            providerName: provider.name,
                            baseQuery: {
                                mediaTypes: ['movie', 'tv'],
                                providerId: provider.id,
                                monetization: 'flatrate',
                                datePreset: 'current-month',
                                sortBy: 'popularity',
                            },
                        };
                    } else if (!isProviderList && section && (!isThisMonthList || catalog.loaded)) {
                        context = {
                            key: section.slug,
                            title: isThisMonthList ? getStreamingThisMonthTitle() : section.title,
                            description: section.description,
                            baseQuery: isThisMonthList
                                ? toStreamingThisMonthQuery(catalog.tvProviders)
                                : section.baseQuery,
                        };
                    }

                    const mediaTypes = context?.baseQuery.mediaTypes ?? [];
                    const requestedType = queryParams.get('type');
                    const defaultType = mediaTypes.includes('tv') || !mediaTypes.length ? 'tv' : mediaTypes[0];

                    return {
                        context,
                        isWaitingForProviders: (isProviderList || isThisMonthList) && !catalog.loaded,
                        mediaType: mediaTypes.find((type) => type === requestedType) ?? defaultType,
                        sortKey: parseEnumParam(
                            queryParams.get('sort'),
                            TMDB_DISCOVER_SORT_KEYS,
                            context?.baseQuery.sortBy ?? DEFAULT_TMDB_DISCOVER_SORT_KEY,
                        ),
                        sortDirection: parseEnumParam(
                            queryParams.get('direction'),
                            TMDB_DISCOVER_SORT_DIRECTIONS,
                            DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
                        ),
                    };
                }),
                distinctUntilChanged(
                    (previous, current) =>
                        previous.context?.key === current.context?.key &&
                        previous.isWaitingForProviders === current.isWaitingForProviders &&
                        previous.mediaType === current.mediaType &&
                        previous.sortKey === current.sortKey &&
                        previous.sortDirection === current.sortDirection,
                ),
            ),
        );
        this.setLibraryStates(userLibraryService.mediaStates$(this.select((state) => remoteData(state.results, []))));
    }

    loadMore$(): Observable<unknown> {
        const { context, results, page, totalPages } = this.get();
        if (!context || results.state !== 'success' || page >= totalPages) {
            return EMPTY;
        }

        this.patchState({ results: { state: 'loading-more', data: results.data } });
        return this.fetchPage$(page + 1);
    }

    setSortKey(value: unknown): void {
        this.navigate({ sort: parseEnumParam(value, TMDB_DISCOVER_SORT_KEYS, this.get().sortKey) });
    }

    toggleSortDirection(): void {
        this.navigate({ direction: this.get().sortDirection === 'asc' ? 'desc' : 'asc' });
    }

    /** Only the media types the list offers can be picked, so the route resolves any other value back. */
    setMediaType(value: unknown): void {
        this.navigate({ type: value === 'movie' || value === 'tv' ? value : this.get().mediaType });
    }

    private fetchPage$(page: number): Observable<unknown> {
        const { context, mediaType, sortKey, sortDirection } = this.get();
        if (!context) {
            return EMPTY;
        }

        return this.streamingQueryService.list$(context.baseQuery, mediaType, sortKey, sortDirection, page).pipe(
            tap((response) =>
                this.patchState((state) => ({
                    page: response.page || page,
                    totalPages: response.totalPages,
                    totalResults: response.totalResults,
                    results: {
                        state: 'success',
                        data: [...(page === 1 ? [] : remoteData(state.results, [])), ...response.items],
                    },
                })),
            ),
            // A failed first page shows the empty state; a failed "show more" keeps what is already listed.
            catchError(() => {
                this.patchState((state) => ({ results: { state: 'success', data: remoteData(state.results, []) } }));
                return EMPTY;
            }),
        );
    }

    private navigate(queryParams: Record<string, string>): void {
        this.router.navigate([], { relativeTo: this.activatedRoute, queryParams, queryParamsHandling: 'merge' });
    }
}
