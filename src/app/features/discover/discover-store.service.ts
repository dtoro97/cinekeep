import { Injectable } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    combineLatest,
    debounceTime,
    distinctUntilChanged,
    exhaustMap,
    forkJoin,
    map,
    merge,
    of,
    switchMap,
    tap,
} from 'rxjs';

import {
    CertificationRestControllerService,
    CompanyRestControllerService,
    Country,
    KeywordRestControllerService,
    Language,
    SearchRestControllerService,
} from '../../api';
import {
    ConfigStoreService,
    DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    DEFAULT_TMDB_DISCOVER_SORT_KEY,
    formatCompanyName,
    isDefined,
    getTmdbDiscoverSortOptions,
    GenreService,
    RemoteData,
    remoteData,
    WatchProviderStoreService,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    parseBoundedIntegerParam,
    parseEnumParam,
    parseLanguageParam,
    parsePageParam,
    parsePositiveIntegerListParam,
    parsePositiveNumberParam,
    parseRegionParam,
    parseStringParam,
    pluralize,
    SelectOption,
    serializeNumberListParam,
    serializePositiveNumberParam,
    SortDirection,
    TMDB_DISCOVER_SORT_DIRECTIONS,
    TMDB_DISCOVER_SORT_KEYS,
    toLanguageOptions,
    MediaStateLookup,
    toLibraryState,
    mediaListItemToCardItem,
    toRegionOptions,
    UserLibraryService,
} from '../../shared';
import {
    DISCOVER_DEFAULT_FILTERS,
    DISCOVER_PAGE_DEFINITIONS,
    DiscoverFilterChange,
    DiscoverFilters,
    DiscoverFilterVisibility,
    DiscoverMovieReleaseType,
    DiscoverPageDefinition,
    DiscoverPageKey,
    DiscoverQueryState,
    DiscoverRuntimePreset,
    MOVIE_RELEASE_TYPE_FILTER_OPTIONS,
    RATING_FILTER_OPTIONS,
    RUNTIME_FILTER_OPTIONS,
    VOTE_COUNT_FILTER_OPTIONS,
} from './discover-page-definitions';
import { DiscoverQueryService } from './discover-query.service';

type ActiveFilterType =
    | 'genre'
    | 'excluded-genres'
    | 'year'
    | 'keyword'
    | 'company'
    | 'provider'
    | 'watch-region'
    | 'certification'
    | 'release-type'
    | 'language'
    | 'rating'
    | 'votes'
    | 'runtime';

/** Filters folded under "More filters"; the panel shows how many of them are active. */
const MORE_FILTER_TYPES: ReadonlySet<ActiveFilterType> = new Set([
    'keyword',
    'company',
    'certification',
    'release-type',
    'language',
    'votes',
    'runtime',
]);

const RESULT_NOUNS: Readonly<Record<MediaType, readonly [string, string]>> = {
    movie: ['movie', 'movies'],
    tv: ['TV series', 'TV series'],
};

const ADVANCED_TITLES: Readonly<Record<MediaType, string>> = {
    movie: 'Discover Movies',
    tv: 'Discover TV Series',
};

export interface DiscoverActiveFilter {
    readonly id: string;
    readonly label: string;
    readonly type: ActiveFilterType;
    readonly value?: number | string;
}

interface DiscoverPagination {
    readonly page: number;
    readonly totalPages: number;
}

interface DiscoverRouteRequest {
    readonly definition: DiscoverPageDefinition | null;
    readonly query: DiscoverQueryState;
    readonly page: number;
    readonly queryKey: string;
    readonly movieGenreMap: ReadonlyMap<number, string>;
    readonly tvGenreMap: ReadonlyMap<number, string>;
    readonly regionOptions: readonly SelectOption<string>[];
    readonly languageOptions: readonly SelectOption<string>[];
}

interface DiscoverState {
    readonly definition: DiscoverPageDefinition | null;
    readonly query: DiscoverQueryState;
    readonly resultsState: RemoteData<MediaListItem[]>;
    readonly pagination: DiscoverPagination;
    readonly totalResults: number;
    readonly movieGenreMap: ReadonlyMap<number, string>;
    readonly tvGenreMap: ReadonlyMap<number, string>;
    readonly providerOptions: readonly SelectOption<number>[];
    readonly certificationOptions: readonly SelectOption<string>[];
    readonly languageOptions: readonly SelectOption<string>[];
    readonly keywordSuggestions: readonly SelectOption<number>[];
    readonly companySuggestions: readonly SelectOption<number>[];
    readonly keywordLabelMap: ReadonlyMap<number, string>;
    readonly companyLabelMap: ReadonlyMap<number, string>;
    readonly regionOptions: readonly SelectOption<string>[];
    /** Watchlist and favorite states for the loaded titles; `null` while signed out. */
    readonly libraryStates: MediaStateLookup | null;
}

const EMPTY_PAGINATION: DiscoverPagination = {
    page: 0,
    totalPages: 0,
};

const INITIAL_STATE: DiscoverState = {
    definition: null,
    query: {
        mediaType: 'movie',
        sortKey: DEFAULT_TMDB_DISCOVER_SORT_KEY,
        sortDirection: DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
        watchRegion: 'US',
        ...DISCOVER_DEFAULT_FILTERS,
    },
    resultsState: { state: 'notAsked' },
    pagination: { ...EMPTY_PAGINATION },
    totalResults: 0,
    movieGenreMap: new Map(),
    tvGenreMap: new Map(),
    providerOptions: [],
    certificationOptions: [],
    languageOptions: [],
    keywordSuggestions: [],
    companySuggestions: [],
    keywordLabelMap: new Map(),
    companyLabelMap: new Map(),
    regionOptions: [],
    libraryStates: null,
};

const DISCOVER_MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv'];

const NO_FILTERS: DiscoverFilterVisibility = {
    genres: false,
    keywords: false,
    companies: false,
    yearRange: false,
    watchRegion: false,
    providers: false,
    certification: false,
    releaseType: false,
    language: false,
    rating: false,
    votes: false,
    runtime: false,
};

const ANY_CERTIFICATION_OPTION: SelectOption<string | null> = { label: 'Any certification', value: null };

const MIN_LOOKUP_QUERY_LENGTH = 2;

const MAX_LOOKUP_SUGGESTIONS = 8;

interface NamedResult {
    readonly id?: number;
    readonly name?: string;
    readonly origin_country?: string;
}

type NamedEntity = NamedResult & { readonly id: number; readonly name: string };

/** A searchable filter, keywords or companies, that the user picks by name and the URL stores by id. */
interface DiscoverLookup {
    readonly selectedIds: (query: DiscoverQueryState) => readonly number[];
    readonly search: (query: string) => Observable<{ readonly results?: readonly NamedResult[] }>;
    readonly details: (id: number) => Observable<NamedResult>;
    readonly toLabel: (entity: NamedEntity) => string;
    readonly setSuggestions: (suggestions: readonly SelectOption<number>[]) => void;
}

const toNamedOptions = (
    entities: readonly NamedResult[],
    toLabel: (entity: NamedEntity) => string,
): SelectOption<number>[] =>
    entities
        .filter((entity): entity is NamedEntity => !!entity.id && !!entity.name)
        .map((entity) => ({ value: entity.id, label: toLabel(entity) }));

const DISCOVER_RUNTIME_PRESETS: readonly DiscoverRuntimePreset[] = ['any', 'short', 'standard', 'long'];

const DISCOVER_MOVIE_RELEASE_TYPES: readonly DiscoverMovieReleaseType[] = [1, 2, 3, 4, 5, 6];

@Injectable()
export class DiscoverStoreService extends ComponentStore<DiscoverState> {
    readonly vm$ = this.select((state) => {
        const definition = state.definition;
        const genreMap = this.getGenreMap(state.query.mediaType, state);
        const hasLoadedResults = state.resultsState.state === 'success' || state.resultsState.state === 'loading-more';
        const visibleCount = remoteData(state.resultsState, []).length;
        const [singularNoun, pluralNoun] = RESULT_NOUNS[state.query.mediaType];
        const activeFilters = this.toActiveFilters(
            definition,
            state.query,
            genreMap,
            state.providerOptions,
            state.keywordLabelMap,
            state.companyLabelMap,
            state.regionOptions,
            state.languageOptions,
        );

        return {
            title: definition?.mode === 'advanced' ? ADVANCED_TITLES[state.query.mediaType] : (definition?.title ?? ''),
            subtitle: definition?.subtitle ?? '',
            resultsState: state.resultsState,
            displayItems: remoteData(state.resultsState, []).map((item) => ({
                item: mediaListItemToCardItem(item),
                libraryState: toLibraryState(state.libraryStates, item),
            })),
            resultCountLabel: pluralize(state.totalResults, singularNoun, pluralNoun),
            hasMore: state.resultsState.state === 'success' && state.pagination.page < state.pagination.totalPages,
            loadingMore: state.resultsState.state === 'loading-more',
            showEmptyState: state.resultsState.state === 'success' && visibleCount === 0,
            showResultCount: hasLoadedResults,
            showSort: !!definition?.showSort,
            showFilters: this.showFilters(definition),
            showReset: this.hasResettableFilters(definition, state.query),
            showMediaTypeToggle: definition?.mode === 'advanced',
            mediaType: state.query.mediaType,
            mediaTypeOptions: MEDIA_TYPE_OPTIONS,
            sortKey: state.query.sortKey,
            sortDirection: state.query.sortDirection,
            sortOptions: getTmdbDiscoverSortOptions(state.query.mediaType),
            filters: this.toDiscoverFilters(
                state,
                genreMap,
                activeFilters.length,
                activeFilters.filter((filter) => MORE_FILTER_TYPES.has(filter.type)).length,
            ),
            lockedFilters: definition?.lockedFilters ?? [],
            activeFilters,
        };
    });

    private readonly routeRequestEffect = this.effect<DiscoverRouteRequest>((request$) =>
        request$.pipe(switchMap((request) => this.handleRouteRequest(request))),
    );

    private readonly updateLibraryStates = this.updater(
        (state, libraryStates: MediaStateLookup | null): DiscoverState => ({ ...state, libraryStates }),
    );

    /** Appends the next page; a new route request replaces the results, so late pages are dropped. */
    readonly loadMore = this.effect<void>((trigger$) =>
        trigger$.pipe(
            exhaustMap(() => {
                const { definition, query, pagination, resultsState } = this.get();

                if (!definition || resultsState.state !== 'success' || pagination.page >= pagination.totalPages) {
                    return EMPTY;
                }

                const loaded = resultsState.data;
                this.patchState({ resultsState: { state: 'loading-more', data: loaded } });

                return this.discoverQuery.list$(definition, query, pagination.page + 1).pipe(
                    tap((result) => {
                        if (this.get().query !== query) {
                            return;
                        }

                        const loadedIds = new Set(loaded.map((item) => item.id));

                        this.patchState({
                            resultsState: {
                                state: 'success',
                                data: [...loaded, ...result.items.filter((item) => !loadedIds.has(item.id))],
                            },
                            pagination: { page: result.page, totalPages: result.totalPages },
                            totalResults: result.totalResults,
                        });
                    }),
                    catchError(() => {
                        if (this.get().query === query) {
                            this.patchState({ resultsState: { state: 'success', data: loaded } });
                        }

                        return EMPTY;
                    }),
                );
            }),
        ),
    );

    private readonly keywordLookup: DiscoverLookup = {
        selectedIds: (query) => query.keywordIds,
        search: (query) => this.searchService.searchKeyword({ query, page: 1 }),
        details: (keywordId) => this.keywordService.keywordDetails({ keywordId }),
        toLabel: (keyword) => keyword.name,
        setSuggestions: (keywordSuggestions) => this.patchState({ keywordSuggestions }),
    };

    private readonly companyLookup: DiscoverLookup = {
        selectedIds: (query) => query.companyIds,
        search: (query) => this.searchService.searchCompany({ query, page: 1 }),
        details: (companyId) => this.companyService.companyDetails({ companyId }),
        toLabel: (company) => formatCompanyName(company.name, company.origin_country),
        setSuggestions: (companySuggestions) => this.patchState({ companySuggestions }),
    };

    private readonly keywordSearchEffect = this.lookupSearchEffect(this.keywordLookup);

    private readonly companySearchEffect = this.lookupSearchEffect(this.companyLookup);

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly discoverQuery: DiscoverQueryService,
        private readonly localeStore: LocaleStoreService,
        private readonly certificationService: CertificationRestControllerService,
        private readonly companyService: CompanyRestControllerService,
        private readonly keywordService: KeywordRestControllerService,
        private readonly searchService: SearchRestControllerService,
        private readonly watchProviderStore: WatchProviderStoreService,
        configStore: ConfigStoreService,
        genreService: GenreService,
        userLibrary: UserLibraryService,
    ) {
        super(INITIAL_STATE);
        this.routeRequestEffect(this.routeRequest$(genreService, configStore));
        this.updateLibraryStates(userLibrary.mediaStates$(this.select((state) => remoteData(state.resultsState, []))));
    }

    updateFilter(change: DiscoverFilterChange): void {
        switch (change.key) {
            case 'genres':
                return this.updateGenres(change.value);
            case 'keywordSearch':
                return this.updateKeywordSearch(change.value);
            case 'keyword':
                return this.addKeyword(change.value);
            case 'companySearch':
                return this.updateCompanySearch(change.value);
            case 'company':
                return this.addCompany(change.value);
            case 'yearFrom':
                return this.updateYearFrom(change.value);
            case 'yearTo':
                return this.updateYearTo(change.value);
            case 'watchRegion':
                return this.updateWatchRegion(change.value);
            case 'providers':
                return this.updateProviders(change.value);
            case 'certification':
                return this.updateCertification(change.value);
            case 'releaseType':
                return this.updateReleaseType(change.value);
            case 'language':
                return this.updateOriginalLanguage(change.value);
            case 'rating':
                return this.updateRating(change.value);
            case 'votes':
                return this.updateVoteCount(change.value);
            case 'runtime':
                return this.updateRuntime(change.value);
        }
    }

    updateMediaType(value: unknown): void {
        const { definition, query } = this.get();

        if (definition?.mode !== 'advanced') {
            return;
        }

        const mediaType = parseEnumParam(value, DISCOVER_MEDIA_TYPES, query.mediaType);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                type: mediaType,
                genres: null,
                providers: null,
                certification: null,
                releaseType: null,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateSort(value: unknown): void {
        const { definition, query } = this.get();

        if (!definition?.showSort) {
            return;
        }

        const sortKey = parseEnumParam(value, TMDB_DISCOVER_SORT_KEYS, query.sortKey);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { sort: sortKey, page: null },
            queryParamsHandling: 'merge',
        });
    }

    toggleSortDirection(): void {
        const { definition, query } = this.get();

        if (!definition?.showSort) {
            return;
        }

        const direction = query.sortDirection === 'asc' ? 'desc' : 'asc';

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { direction, page: null },
            queryParamsHandling: 'merge',
        });
    }

    updateGenres(value: unknown): void {
        if (!this.isFilterVisible('genres')) {
            return;
        }

        const genreIds = Array.isArray(value)
            ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0)
            : [];

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                genres: serializeNumberListParam(genreIds),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateKeywordSearch(query: string): void {
        if (!this.isFilterVisible('keywords')) {
            return;
        }

        this.keywordSearchEffect(query);
    }

    addKeyword(value: unknown): void {
        if (!this.isFilterVisible('keywords')) {
            return;
        }

        const keywordId = Number(value);
        if (!Number.isFinite(keywordId) || keywordId <= 0) {
            return;
        }

        const keywordIds = [...new Set([...this.get().query.keywordIds, keywordId])];
        this.patchState({ keywordSuggestions: [] });

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                keywords: serializeNumberListParam(keywordIds),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateCompanySearch(query: string): void {
        if (!this.isFilterVisible('companies')) {
            return;
        }

        this.companySearchEffect(query);
    }

    addCompany(value: unknown): void {
        if (!this.isFilterVisible('companies')) {
            return;
        }

        const companyId = Number(value);
        if (!Number.isFinite(companyId) || companyId <= 0) {
            return;
        }

        const companyIds = [...new Set([...this.get().query.companyIds, companyId])];
        this.patchState({ companySuggestions: [] });

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                companies: serializeNumberListParam(companyIds),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateYearFrom(value: unknown): void {
        if (!this.isFilterVisible('yearRange')) {
            return;
        }

        this.updateYearRange(serializePositiveNumberParam(value), this.get().query.yearTo);
    }

    updateYearTo(value: unknown): void {
        if (!this.isFilterVisible('yearRange')) {
            return;
        }

        this.updateYearRange(this.get().query.yearFrom, serializePositiveNumberParam(value));
    }

    updateProviders(value: unknown): void {
        if (!this.isFilterVisible('providers')) {
            return;
        }

        const providerIds = Array.isArray(value)
            ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0)
            : [];

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                providers: serializeNumberListParam(providerIds),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateCertification(value: unknown): void {
        if (!this.isFilterVisible('certification')) {
            return;
        }

        const certification = typeof value === 'string' && value.trim() ? value.trim() : null;

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                certification,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateReleaseType(value: unknown): void {
        const { definition, query } = this.get();

        if (!this.showReleaseTypeFilter(definition, query.mediaType)) {
            return;
        }

        const releaseType = this.toMovieReleaseType(value);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                releaseType,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateOriginalLanguage(value: unknown): void {
        if (!this.isFilterVisible('language')) {
            return;
        }

        const originalLanguage = typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                language: originalLanguage,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateWatchRegion(value: unknown): void {
        if (!this.isFilterVisible('watchRegion')) {
            return;
        }

        const defaultRegion = this.localeStore.region() || 'US';
        const watchRegion = parseRegionParam(value, this.get().query.watchRegion);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                watchRegion: watchRegion === defaultRegion ? null : watchRegion,
                providers: null,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateRating(value: unknown): void {
        if (!this.isFilterVisible('rating')) {
            return;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                rating: serializePositiveNumberParam(value),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateVoteCount(value: unknown): void {
        if (!this.isFilterVisible('votes')) {
            return;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                votes: this.serializeVoteCount(value),
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    updateRuntime(value: unknown): void {
        if (!this.isFilterVisible('runtime')) {
            return;
        }

        const runtime = parseEnumParam(value, DISCOVER_RUNTIME_PRESETS, 'any');

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                runtime: runtime === 'any' ? null : runtime,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    clearFilter(filter: DiscoverActiveFilter): void {
        if (filter.type === 'genre') {
            const nextGenres = this.get().query.genreIds.filter((genreId) => genreId !== Number(filter.value));
            this.updateGenres(nextGenres);
            return;
        }

        if (filter.type === 'provider') {
            const nextProviders = this.get().query.providerIds.filter(
                (providerId) => providerId !== Number(filter.value),
            );
            this.updateProviders(nextProviders);
            return;
        }

        if (filter.type === 'keyword') {
            const nextKeywords = this.get().query.keywordIds.filter((keywordId) => keywordId !== Number(filter.value));
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: {
                    keywords: serializeNumberListParam(nextKeywords),
                    page: null,
                },
                queryParamsHandling: 'merge',
            });
            return;
        }

        if (filter.type === 'company') {
            const nextCompanies = this.get().query.companyIds.filter((companyId) => companyId !== Number(filter.value));
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: {
                    companies: serializeNumberListParam(nextCompanies),
                    page: null,
                },
                queryParamsHandling: 'merge',
            });
            return;
        }

        if (filter.type === 'year') {
            const value = String(filter.value);
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: {
                    yearFrom: value === 'from' || value === 'range' ? null : this.get().query.yearFrom,
                    yearTo: value === 'to' || value === 'range' ? null : this.get().query.yearTo,
                    page: null,
                },
                queryParamsHandling: 'merge',
            });
            return;
        }

        const queryParams: Record<string, string | number | null> = {};

        if (filter.type === 'watch-region') {
            queryParams['watchRegion'] = null;
            queryParams['providers'] = null;
            queryParams['page'] = null;
        }

        if (filter.type === 'certification') {
            queryParams['certification'] = null;
            queryParams['page'] = null;
        }

        if (filter.type === 'release-type') {
            queryParams['releaseType'] = null;
            queryParams['page'] = null;
        }

        if (filter.type === 'language') {
            queryParams['language'] = null;
            queryParams['page'] = null;
        }

        if (filter.type === 'rating') {
            queryParams['rating'] = null;
            queryParams['page'] = null;
        }

        if (filter.type === 'votes') {
            queryParams['votes'] = this.serializeVoteCount(null);
            queryParams['page'] = null;
        }

        if (filter.type === 'excluded-genres') {
            queryParams['exclude'] = 'none';
            queryParams['page'] = null;
        }

        if (filter.type === 'runtime') {
            queryParams['runtime'] = null;
            queryParams['page'] = null;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams,
            queryParamsHandling: 'merge',
        });
    }

    reset(): void {
        const { definition, query } = this.get();
        const queryParams =
            definition?.mode === 'advanced' && query.mediaType !== definition.mediaType
                ? { type: query.mediaType }
                : {};

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams,
        });
    }

    private updateYearRange(yearFrom: number | null, yearTo: number | null): void {
        const nextYearFrom = yearFrom !== null && yearTo !== null && yearFrom > yearTo ? yearTo : yearFrom;
        const nextYearTo = yearFrom !== null && yearTo !== null && yearFrom > yearTo ? yearFrom : yearTo;

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                yearFrom: nextYearFrom,
                yearTo: nextYearTo,
                page: null,
            },
            queryParamsHandling: 'merge',
        });
    }

    private routeRequest$(
        genreService: GenreService,
        configStore: ConfigStoreService,
    ): Observable<DiscoverRouteRequest> {
        return combineLatest({
            data: this.route.data,
            queryParams: this.route.queryParamMap,
            movieGenreMap: genreService.movieGenres$,
            tvGenreMap: genreService.tvGenres$,
            countries: configStore.countries$,
            languages: configStore.languages$,
            defaultRegion: this.localeStore.region$,
        }).pipe(
            map((source) => this.toRouteRequest(source)),
            distinctUntilChanged((previous, current) => previous.queryKey === current.queryKey),
        );
    }

    private toRouteRequest(source: {
        readonly data: Record<string, unknown>;
        readonly queryParams: ParamMap;
        readonly movieGenreMap: ReadonlyMap<number, string>;
        readonly tvGenreMap: ReadonlyMap<number, string>;
        readonly countries: readonly Country[];
        readonly languages: readonly Language[];
        readonly defaultRegion: string;
    }): DiscoverRouteRequest {
        const routePageKey = source.data['discoverPageKey'];
        const pageKey =
            typeof routePageKey === 'string' && routePageKey in DISCOVER_PAGE_DEFINITIONS
                ? (routePageKey as DiscoverPageKey)
                : null;
        const definition = pageKey ? DISCOVER_PAGE_DEFINITIONS[pageKey] : null;
        const query = this.toQueryState(definition, source.queryParams, source.defaultRegion);
        const page = parsePageParam(source.queryParams.get('page'));
        const regionOptions = toRegionOptions(source.countries, query.watchRegion);
        const languageOptions = toLanguageOptions(source.languages);
        const queryKey = JSON.stringify({
            pageKey,
            query,
            page,
            movieGenres: [...source.movieGenreMap.entries()],
            tvGenres: [...source.tvGenreMap.entries()],
            regionOptions,
            languageOptions,
        });

        return {
            definition,
            query,
            page,
            queryKey,
            movieGenreMap: source.movieGenreMap,
            tvGenreMap: source.tvGenreMap,
            regionOptions,
            languageOptions,
        };
    }

    private toQueryState(
        definition: DiscoverPageDefinition | null,
        params: ParamMap,
        defaultRegion: string,
    ): DiscoverQueryState {
        const fallbackRegion = defaultRegion || 'US';

        if (!definition) {
            return {
                mediaType: 'movie',
                sortKey: DEFAULT_TMDB_DISCOVER_SORT_KEY,
                sortDirection: DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
                watchRegion: fallbackRegion,
                ...DISCOVER_DEFAULT_FILTERS,
            };
        }

        const mediaType =
            definition.mode === 'advanced'
                ? parseEnumParam(params.get('type'), DISCOVER_MEDIA_TYPES, definition.mediaType)
                : definition.mediaType;
        const filters = definition.filters;

        return {
            mediaType,
            watchRegion: filters.watchRegion
                ? parseRegionParam(params.get('watchRegion'), fallbackRegion)
                : fallbackRegion,
            sortKey: definition.showSort
                ? parseEnumParam(params.get('sort'), TMDB_DISCOVER_SORT_KEYS, definition.defaultSortKey)
                : definition.defaultSortKey,
            sortDirection: definition.showSort
                ? parseEnumParam(params.get('direction'), TMDB_DISCOVER_SORT_DIRECTIONS, definition.defaultSortDirection)
                : definition.defaultSortDirection,
            genreIds: filters.genres ? parsePositiveIntegerListParam(params.get('genres')) : [],
            excludedGenreIds: this.resolveExcludedGenreIds(definition, params),
            keywordIds: filters.keywords ? parsePositiveIntegerListParam(params.get('keywords')) : [],
            companyIds: filters.companies ? parsePositiveIntegerListParam(params.get('companies')) : [],
            providerIds: filters.providers ? parsePositiveIntegerListParam(params.get('providers')) : [],
            yearFrom: filters.yearRange ? parseBoundedIntegerParam(params.get('yearFrom'), 1874, 2100) : null,
            yearTo: filters.yearRange ? parseBoundedIntegerParam(params.get('yearTo'), 1874, 2100) : null,
            certification:
                filters.certification && mediaType === 'movie' ? parseStringParam(params.get('certification')) : null,
            releaseType: this.showReleaseTypeFilter(definition, mediaType)
                ? this.toMovieReleaseType(params.get('releaseType'))
                : null,
            originalLanguage: filters.language ? parseLanguageParam(params.get('language')) : null,
            voteAverageGte: filters.rating ? parsePositiveNumberParam(params.get('rating')) : null,
            voteCountGte: this.resolveVoteCountGte(definition, params),
            runtimePreset: filters.runtime ? parseEnumParam(params.get('runtime'), DISCOVER_RUNTIME_PRESETS, 'any') : 'any',
        };
    }

    private handleRouteRequest(request: DiscoverRouteRequest) {
        if (!request.definition) {
            this.router.navigateByUrl('/not-found', { replaceUrl: true });
            return EMPTY;
        }

        const definition = request.definition;

        this.patchState({
            definition,
            query: request.query,
            resultsState: { state: 'loading' },
            pagination: { ...EMPTY_PAGINATION },
            totalResults: 0,
            movieGenreMap: request.movieGenreMap,
            tvGenreMap: request.tvGenreMap,
            providerOptions: [],
            certificationOptions: [],
            languageOptions: request.languageOptions,
            keywordSuggestions: [],
            companySuggestions: [],
            keywordLabelMap: new Map(),
            companyLabelMap: new Map(),
            regionOptions: request.regionOptions,
        });

        return merge(
            this.fetchPage$(definition, request.query, request.page),
            forkJoin({
                providerOptions: this.fetchProviderOptions$(request.query.mediaType, request.query.watchRegion),
                certificationOptions: this.fetchCertificationOptions$(
                    definition,
                    request.query.mediaType,
                    request.query.watchRegion,
                ),
            }).pipe(
                tap(({ providerOptions, certificationOptions }) => {
                    this.patchState({
                        providerOptions,
                        certificationOptions,
                    });
                }),
            ),
            forkJoin({
                keywordLabelMap: this.fetchLabelMap$(this.keywordLookup, request.query.keywordIds),
                companyLabelMap: this.fetchLabelMap$(this.companyLookup, request.query.companyIds),
            }).pipe(
                tap(({ keywordLabelMap, companyLabelMap }) => {
                    this.patchState({
                        keywordLabelMap,
                        companyLabelMap,
                    });
                }),
            ),
        );
    }

    private fetchPage$(definition: DiscoverPageDefinition, query: DiscoverQueryState, page: number) {
        return this.discoverQuery.list$(definition, query, page).pipe(
            tap((result) => {
                this.patchState({
                    resultsState: { state: 'success', data: [...result.items] },
                    pagination: {
                        page: result.page,
                        totalPages: result.totalPages,
                    },
                    totalResults: result.totalResults,
                });
            }),
            catchError(() => {
                this.patchState({
                    resultsState: {
                        state: 'success',
                        data: [],
                    },
                    pagination: { page, totalPages: page },
                    totalResults: 0,
                });
                return EMPTY;
            }),
        );
    }

    private fetchProviderOptions$(mediaType: MediaType, watchRegion: string): Observable<SelectOption<number>[]> {
        return this.watchProviderStore
            .providers$(mediaType, watchRegion)
            .pipe(map((providers) => providers.map((provider) => ({ value: provider.id, label: provider.name }))));
    }

    private fetchCertificationOptions$(
        definition: DiscoverPageDefinition,
        mediaType: MediaType,
        watchRegion: string,
    ): Observable<SelectOption<string>[]> {
        if (!definition.filters.certification || mediaType !== 'movie') {
            return of([]);
        }

        return this.certificationService.certificationMovieList().pipe(
            map((result) => {
                const certifications = result.certifications?.[watchRegion] ?? result.certifications?.['US'] ?? [];

                return certifications
                    .filter(
                        (
                            certification,
                        ): certification is typeof certification & {
                            certification: string;
                        } => !!certification.certification,
                    )
                    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
                    .map((certification) => ({
                        label: certification.certification,
                        value: certification.certification,
                    }));
            }),
            catchError(() => of([] as SelectOption<string>[])),
        );
    }

    private lookupSearchEffect(lookup: DiscoverLookup) {
        return this.effect<string>((query$) =>
            query$.pipe(
                debounceTime(250),
                map((query) => query.trim()),
                distinctUntilChanged(),
                switchMap((query) => this.fetchSuggestions$(lookup, query)),
            ),
        );
    }

    private fetchSuggestions$(lookup: DiscoverLookup, query: string) {
        if (query.length < MIN_LOOKUP_QUERY_LENGTH) {
            lookup.setSuggestions([]);
            return EMPTY;
        }

        return lookup.search(query).pipe(
            tap((result) => {
                const selectedIds = new Set(lookup.selectedIds(this.get().query));

                lookup.setSuggestions(
                    toNamedOptions(result.results ?? [], lookup.toLabel)
                        .filter((option) => !selectedIds.has(option.value))
                        .slice(0, MAX_LOOKUP_SUGGESTIONS),
                );
            }),
            catchError(() => {
                lookup.setSuggestions([]);
                return EMPTY;
            }),
        );
    }

    /** Labels for the selected ids, so active filter chips show names instead of ids. */
    private fetchLabelMap$(lookup: DiscoverLookup, ids: readonly number[]): Observable<ReadonlyMap<number, string>> {
        const uniqueIds = [...new Set(ids)];

        if (!uniqueIds.length) {
            return of(new Map<number, string>());
        }

        return forkJoin(uniqueIds.map((id) => lookup.details(id).pipe(catchError(() => of(null))))).pipe(
            map(
                (entities) =>
                    new Map(
                        toNamedOptions(entities.filter(isDefined), lookup.toLabel).map((option) => [
                            option.value,
                            option.label,
                        ]),
                    ),
            ),
            catchError(() => of(new Map<number, string>())),
        );
    }

    private toDiscoverFilters(
        state: DiscoverState,
        genreMap: ReadonlyMap<number, string>,
        activeFilterCount: number,
        moreActiveCount: number,
    ): DiscoverFilters {
        const { definition, query } = state;
        const filters = definition?.filters ?? NO_FILTERS;

        const visible = {
            ...filters,
            certification: filters.certification && query.mediaType === 'movie',
            releaseType: this.showReleaseTypeFilter(definition, query.mediaType),
        };

        return {
            activeFilterCount,
            moreActiveCount,
            hasMoreFilters:
                visible.keywords ||
                visible.companies ||
                visible.certification ||
                visible.releaseType ||
                visible.language ||
                visible.votes ||
                visible.runtime,
            visible,
            genreOptions: this.toGenreOptions(genreMap, query.excludedGenreIds),
            selectedGenreIds: query.genreIds,
            keywordSuggestions: state.keywordSuggestions,
            companySuggestions: state.companySuggestions,
            yearFrom: query.yearFrom,
            yearTo: query.yearTo,
            watchRegionOptions: state.regionOptions,
            watchRegion: query.watchRegion,
            providerOptions: state.providerOptions,
            selectedProviderIds: query.providerIds,
            certificationOptions: [ANY_CERTIFICATION_OPTION, ...state.certificationOptions],
            certification: query.certification,
            releaseTypeOptions: MOVIE_RELEASE_TYPE_FILTER_OPTIONS,
            releaseType: query.releaseType,
            languageOptions: state.languageOptions,
            language: query.originalLanguage,
            ratingOptions: RATING_FILTER_OPTIONS,
            rating: query.voteAverageGte,
            voteCountOptions: VOTE_COUNT_FILTER_OPTIONS,
            voteCount: query.voteCountGte,
            runtimeOptions: RUNTIME_FILTER_OPTIONS,
            runtime: query.runtimePreset,
        };
    }

    private toActiveFilters(
        definition: DiscoverPageDefinition | null,
        query: DiscoverQueryState,
        genreMap: ReadonlyMap<number, string>,
        providerOptions: readonly SelectOption<number>[],
        keywordLabelMap: ReadonlyMap<number, string>,
        companyLabelMap: ReadonlyMap<number, string>,
        regionOptions: readonly SelectOption<string>[],
        languageOptions: readonly SelectOption<string>[],
    ): DiscoverActiveFilter[] {
        if (!definition) {
            return [];
        }

        const filters = definition.filters;
        const activeFilters: DiscoverActiveFilter[] = [];
        const providerLabelMap = new Map(providerOptions.map((option) => [option.value, option.label]));
        const defaultWatchRegion = this.localeStore.region() || 'US';

        if (filters.genres) {
            query.genreIds.forEach((genreId) => {
                activeFilters.push({
                    id: `genre-${genreId}`,
                    label: genreMap.get(genreId) ?? `Genre ${genreId}`,
                    type: 'genre',
                    value: genreId,
                });
            });
        }

        if (definition.defaultGenreExclusion && query.excludedGenreIds.length) {
            activeFilters.push({
                id: 'excluded-genres',
                label: definition.defaultGenreExclusion.label,
                type: 'excluded-genres',
            });
        }

        if (filters.providers) {
            query.providerIds.forEach((providerId) => {
                activeFilters.push({
                    id: `provider-${providerId}`,
                    label: providerLabelMap.get(providerId) ?? `Provider ${providerId}`,
                    type: 'provider',
                    value: providerId,
                });
            });
        }

        if (filters.keywords) {
            query.keywordIds.forEach((keywordId) => {
                activeFilters.push({
                    id: `keyword-${keywordId}`,
                    label: keywordLabelMap.get(keywordId) ?? `Keyword ${keywordId}`,
                    type: 'keyword',
                    value: keywordId,
                });
            });
        }

        if (filters.companies) {
            query.companyIds.forEach((companyId) => {
                activeFilters.push({
                    id: `company-${companyId}`,
                    label: companyLabelMap.get(companyId) ?? `Company ${companyId}`,
                    type: 'company',
                    value: companyId,
                });
            });
        }

        if (filters.yearRange && (query.yearFrom !== null || query.yearTo !== null)) {
            activeFilters.push({
                id: 'year-range',
                label: this.toYearRangeLabel(query.yearFrom, query.yearTo),
                type: 'year',
                value: 'range',
            });
        }

        if (filters.watchRegion && query.watchRegion !== defaultWatchRegion) {
            const region = regionOptions.find((option) => option.value === query.watchRegion);
            activeFilters.push({
                id: 'watch-region',
                label: `Region: ${region?.label ?? query.watchRegion}`,
                type: 'watch-region',
                value: query.watchRegion,
            });
        }

        if (filters.certification && query.certification) {
            activeFilters.push({
                id: 'certification',
                label: `Rated ${query.certification}`,
                type: 'certification',
            });
        }

        if (this.showReleaseTypeFilter(definition, query.mediaType) && query.releaseType !== null) {
            activeFilters.push({
                id: 'release-type',
                label: this.toReleaseTypeFilterLabel(query.releaseType),
                type: 'release-type',
            });
        }

        if (filters.language && query.originalLanguage) {
            activeFilters.push({
                id: 'language',
                label: this.toLanguageFilterLabel(query.originalLanguage, languageOptions),
                type: 'language',
            });
        }

        if (filters.rating && query.voteAverageGte !== null) {
            activeFilters.push({
                id: 'rating',
                label: `${query.voteAverageGte}+ rating`,
                type: 'rating',
            });
        }

        if (filters.votes && query.voteCountGte !== null) {
            activeFilters.push({
                id: 'votes',
                label: `${query.voteCountGte}+ votes`,
                type: 'votes',
            });
        }

        if (filters.runtime && query.runtimePreset !== 'any') {
            const option = RUNTIME_FILTER_OPTIONS.find((entry) => entry.value === query.runtimePreset);
            activeFilters.push({
                id: 'runtime',
                label: option?.label ?? 'Runtime',
                type: 'runtime',
            });
        }

        return activeFilters;
    }

    private getGenreMap(mediaType: MediaType, state: DiscoverState): ReadonlyMap<number, string> {
        return mediaType === 'movie' ? state.movieGenreMap : state.tvGenreMap;
    }

    private toGenreOptions(
        genreMap: ReadonlyMap<number, string>,
        excludedGenreIds: readonly number[],
    ): SelectOption<number>[] {
        return [...genreMap.entries()]
            .filter(([value]) => !excludedGenreIds.includes(value))
            .map(([value, label]) => ({ label, value }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }

    private toYearRangeLabel(yearFrom: number | null, yearTo: number | null): string {
        if (yearFrom !== null && yearTo !== null) {
            return `Years: ${yearFrom}-${yearTo}`;
        }

        if (yearFrom !== null) {
            return `From ${yearFrom}`;
        }

        return yearTo !== null ? `Until ${yearTo}` : 'Years';
    }

    private toLanguageFilterLabel(language: string, languageOptions: readonly SelectOption<string>[]): string {
        const option = languageOptions.find((entry) => entry.value === language);
        return `Language: ${option?.label ?? language.toUpperCase()}`;
    }

    private toReleaseTypeFilterLabel(releaseType: DiscoverMovieReleaseType): string {
        const option = MOVIE_RELEASE_TYPE_FILTER_OPTIONS.find((entry) => entry.value === releaseType);
        return `Release: ${option?.label ?? releaseType}`;
    }

    private showFilters(definition: DiscoverPageDefinition | null): boolean {
        if (!definition) {
            return false;
        }

        return Object.values(definition.filters).some(Boolean);
    }

    private showReleaseTypeFilter(definition: DiscoverPageDefinition | null, mediaType: MediaType): boolean {
        return mediaType === 'movie' && !!definition?.filters.releaseType;
    }

    private hasResettableFilters(definition: DiscoverPageDefinition | null, query: DiscoverQueryState): boolean {
        if (!definition) {
            return false;
        }

        const filters = definition.filters;

        return (
            (filters.genres && query.genreIds.length > 0) ||
            (filters.keywords && query.keywordIds.length > 0) ||
            (filters.companies && query.companyIds.length > 0) ||
            (filters.providers && query.providerIds.length > 0) ||
            (filters.yearRange && (query.yearFrom !== null || query.yearTo !== null)) ||
            (filters.watchRegion && query.watchRegion !== (this.localeStore.region() || 'US')) ||
            (filters.certification && query.certification !== null) ||
            (this.showReleaseTypeFilter(definition, query.mediaType) && query.releaseType !== null) ||
            (filters.language && query.originalLanguage !== null) ||
            (filters.rating && query.voteAverageGte !== null) ||
            this.hasResettableVoteFilter(definition, query) ||
            (!!definition.defaultGenreExclusion && !query.excludedGenreIds.length) ||
            (filters.runtime && query.runtimePreset !== 'any')
        );
    }

    private hasResettableVoteFilter(definition: DiscoverPageDefinition, query: DiscoverQueryState): boolean {
        if (!definition.filters.votes) {
            return false;
        }

        return query.voteCountGte !== (definition.defaultVoteCountGte ?? null);
    }

    private isFilterVisible(filter: keyof DiscoverFilterVisibility): boolean {
        return !!this.get().definition?.filters[filter];
    }

    private toMovieReleaseType(value: unknown): DiscoverMovieReleaseType | null {
        const releaseType = Number(value);

        return value !== null && DISCOVER_MOVIE_RELEASE_TYPES.includes(releaseType as DiscoverMovieReleaseType)
            ? (releaseType as DiscoverMovieReleaseType)
            : null;
    }

    private resolveVoteCountGte(definition: DiscoverPageDefinition, params: ParamMap): number | null {
        if (definition.lockedVoteCountGte !== undefined) {
            return definition.lockedVoteCountGte;
        }

        if (!definition.filters.votes) {
            return null;
        }

        if (params.get('votes') === 'any') {
            return null;
        }

        return parsePositiveNumberParam(params.get('votes')) ?? definition.defaultVoteCountGte ?? null;
    }

    private resolveExcludedGenreIds(definition: DiscoverPageDefinition, params: ParamMap): readonly number[] {
        if (!definition.defaultGenreExclusion || params.get('exclude') === 'none') {
            return [];
        }

        return definition.defaultGenreExclusion.genreIds;
    }

    private serializeVoteCount(value: unknown): string | number | null {
        const voteCount = serializePositiveNumberParam(value);
        const defaultVoteCount = this.get().definition?.defaultVoteCountGte ?? null;

        if (voteCount === null) {
            return defaultVoteCount !== null ? 'any' : null;
        }

        return voteCount === defaultVoteCount ? null : voteCount;
    }
}
