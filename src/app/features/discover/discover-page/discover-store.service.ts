import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    combineLatest,
    debounceTime,
    distinctUntilChanged,
    EMPTY,
    filter,
    forkJoin,
    map,
    merge,
    Observable,
    ObservedValueOf,
    of,
    switchMap,
    take,
    tap,
} from 'rxjs';

import {
    CertificationRestControllerService,
    CompanyRestControllerService,
    KeywordRestControllerService,
    SearchRestControllerService,
} from '../../../api';
import { OPENING_SOON_MOVIE_DAYS_AHEAD, PAGE_SIZE } from '../../../constants';
import {
    ConfigStoreService,
    DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
    DEFAULT_TMDB_DISCOVER_SORT_KEY,
    filterOptionsByQuery,
    formatCompanyName,
    GenreService,
    getISODate,
    hasIdAndName,
    getTmdbDiscoverSortOptions,
    hasRemoteData,
    isDefined,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    mediaListItemToCardItem,
    MediaStateLookup,
    MediaType,
    parseBoundedIntegerParam,
    parseEnumParam,
    parseLanguageParam,
    parsePositiveIntegerListParam,
    parsePositiveNumberParam,
    parseRegionParam,
    parseStringParam,
    pluralize,
    RemoteData,
    remoteData,
    remoteSuccess,
    SelectOption,
    serializeNumberListParam,
    SORT_DIRECTIONS,
    TMDB_DISCOVER_SORT_KEYS,
    TmdbDiscoverService,
    TmdbDiscoverSortKey,
    toLanguageOptions,
    toLibraryState,
    toMediaListItem,
    toRegionOptions,
    UserLibraryService,
    WatchProviderStoreService,
} from '../../../shared';
import {
    DISCOVER_PAGE_DEFINITIONS,
    DiscoverDateWindow,
    DiscoverFilterVisibility,
    DiscoverMovieReleaseType,
    DiscoverPageDefinition,
    DiscoverQueryState,
    DiscoverRuntimePreset,
    MOVIE_RELEASE_TYPE_FILTER_OPTIONS,
    RATING_FILTER_OPTIONS,
    RUNTIME_FILTER_OPTIONS,
    VOTE_COUNT_FILTER_OPTIONS,
} from '../discover-page-definitions';

/** A change from the filter panel; the search keys carry the typed text. */
export type DiscoverFilterChange =
    | { readonly key: 'keywordSearch' | 'companySearch' | 'languageSearch' | 'watchRegion'; readonly value: string }
    | { readonly key: 'keyword' | 'company'; readonly value: number }
    | { readonly key: 'genres' | 'providers'; readonly value: readonly number[] }
    | { readonly key: 'yearFrom' | 'yearTo' | 'rating' | 'votes'; readonly value: number | null }
    | { readonly key: 'certification' | 'language'; readonly value: string | null }
    | { readonly key: 'releaseType'; readonly value: DiscoverMovieReleaseType | null }
    | { readonly key: 'runtime'; readonly value: DiscoverRuntimePreset };

export interface DiscoverActiveFilter {
    readonly id: string;
    readonly label: string;
    readonly group: keyof DiscoverFilterVisibility;
    /** The query params that remove this filter. */
    readonly clearParams: Record<string, string | number | null>;
}

/** Everything the filter panel renders: which filters show, their options, and the current values. */
export type DiscoverFilters = ObservedValueOf<DiscoverStoreService['discover$']>['filters'];

/** The searchable filters, picked by name and stored in the URL by id. */
type LookupKey = 'keyword' | 'company';

interface DiscoverRequest {
    readonly definition: DiscoverPageDefinition;
    readonly visible: DiscoverFilterVisibility;
    readonly query: DiscoverQueryState;
    readonly defaultRegion: string;
    readonly requestKey: string;
}

interface DiscoverState {
    readonly definition: DiscoverPageDefinition | null;
    /** The filters this page offers for the current media type. */
    readonly visible: DiscoverFilterVisibility;
    readonly query: DiscoverQueryState;
    /** The locale's region; a watch region other than this one counts as an active filter. */
    readonly defaultRegion: string;
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
    readonly results: RemoteData<MediaListItem[]>;
    readonly providerOptions: readonly SelectOption<number>[];
    /** Movie certifications per region, loaded once since the response covers every region. */
    readonly certifications: Record<string, readonly SelectOption<string>[]>;
    readonly suggestions: Record<LookupKey, readonly SelectOption<number>[]>;
    readonly labels: Record<LookupKey, ReadonlyMap<number, string>>;
    readonly languageSearch: string;
    /** Watchlist and favorite states for the loaded titles; `null` while signed out. */
    readonly libraryStates: MediaStateLookup | null;
}

interface NamedResult {
    readonly id?: number;
    readonly name?: string;
    readonly origin_country?: string;
}

interface DiscoverLookup {
    readonly param: 'keywords' | 'companies';
    readonly selectedIds: (query: DiscoverQueryState) => readonly number[];
    readonly search: (text: string) => Observable<{ readonly results?: readonly NamedResult[] }>;
    readonly details: (id: number) => Observable<NamedResult>;
    readonly toLabel: (entity: NamedResult & { readonly name: string }) => string;
}

/** Whose certifications to offer when the watch region has none of its own. */
const CERTIFICATION_FALLBACK_REGION = 'US';
const LOADING_MORE_SKELETON_COUNT = 5;
const MIN_LOOKUP_QUERY_LENGTH = 2;
const MAX_LOOKUP_SUGGESTIONS = 8;
const MIN_YEAR = 1874;
const MAX_YEAR = 2100;

const RESULT_NOUNS: Record<MediaType, readonly [string, string]> = {
    movie: ['movie', 'movies'],
    tv: ['TV series', 'TV series'],
};

const ADVANCED_TITLES: Record<MediaType, string> = {
    movie: 'Discover Movies',
    tv: 'Discover TV Series',
};

/** Filters folded under "More filters"; the panel shows how many of them are active. */
const MORE_FILTER_GROUPS: readonly (keyof DiscoverFilterVisibility)[] = [
    'keywords',
    'companies',
    'certification',
    'releaseType',
    'language',
    'votes',
    'runtime',
];

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

/** Days from today where each date window starts and ends. */
const DATE_WINDOW_DAYS: Record<DiscoverDateWindow, readonly [number, number]> = {
    'airing-today': [0, 0],
    'now-playing': [-15, 15],
    'on-the-air': [0, 7],
    upcoming: [0, OPENING_SOON_MOVIE_DAYS_AHEAD],
};

const RUNTIME_RANGES: Record<DiscoverRuntimePreset, { readonly min?: number; readonly max?: number }> = {
    any: {},
    short: { max: 30 },
    standard: { min: 30, max: 120 },
    long: { min: 120 },
};

const INITIAL_STATE: DiscoverState = {
    definition: null,
    visible: NO_FILTERS,
    query: {
        mediaType: 'movie',
        sortKey: DEFAULT_TMDB_DISCOVER_SORT_KEY,
        sortDirection: DEFAULT_TMDB_DISCOVER_SORT_DIRECTION,
        watchRegion: '',
        genreIds: [],
        excludedGenreIds: [],
        keywordIds: [],
        companyIds: [],
        providerIds: [],
        yearFrom: null,
        yearTo: null,
        certification: null,
        releaseType: null,
        originalLanguage: null,
        voteAverageGte: null,
        voteCountGte: null,
        runtimePreset: 'any',
    },
    defaultRegion: '',
    page: 0,
    totalPages: 0,
    totalResults: 0,
    results: { state: 'notAsked' },
    providerOptions: [],
    certifications: {},
    suggestions: { keyword: [], company: [] },
    labels: { keyword: new Map(), company: new Map() },
    languageSearch: '',
    libraryStates: null,
};

@Injectable()
export class DiscoverStoreService extends ComponentStore<DiscoverState> {
    readonly discover$ = this.select(
        this.state$,
        // Genres only name the genre options and chips, which fall back to ids without them.
        this.genreService.movieGenres$.pipe(catchError(() => of(new Map<number, string>()))),
        this.genreService.tvGenres$.pipe(catchError(() => of(new Map<number, string>()))),
        this.configStoreService.countries$,
        this.configStoreService.languages$.pipe(map(toLanguageOptions)),
        (state, movieGenres, tvGenres, countries, languageOptions) => {
            const { definition, visible, query, defaultRegion, results, page, totalPages, labels } = state;
            const items = remoteData(results, []);
            const [singularNoun, pluralNoun] = RESULT_NOUNS[query.mediaType];
            const genreMap = query.mediaType === 'movie' ? movieGenres : tvGenres;
            const regionOptions = toRegionOptions(countries, query.watchRegion);
            const findLabel = <T>(options: readonly { readonly label: string; readonly value: T }[], value: T) =>
                options.find((option) => option.value === value)?.label;
            /** One chip per selected id; the filter group doubles as the query param name. */
            const toIdFilters = (
                group: 'genres' | 'providers' | 'keywords' | 'companies',
                ids: readonly number[],
                toLabel: (id: number) => string,
            ): DiscoverActiveFilter[] =>
                visible[group]
                    ? ids.map((id) => ({
                          id: `${group}-${id}`,
                          label: toLabel(id),
                          group,
                          clearParams: { [group]: serializeNumberListParam(ids.filter((otherId) => otherId !== id)) },
                      }))
                    : [];

            const activeFilters = [
                ...toIdFilters('genres', query.genreIds, (id) => genreMap.get(id) ?? `Genre ${id}`),
                definition?.defaultGenreExclusion && query.excludedGenreIds.length > 0
                    ? {
                          id: 'excluded-genres',
                          label: definition.defaultGenreExclusion.label,
                          group: 'genres' as const,
                          clearParams: { exclude: 'none' },
                      }
                    : null,
                ...toIdFilters(
                    'providers',
                    query.providerIds,
                    (id) => findLabel(state.providerOptions, id) ?? `Provider ${id}`,
                ),
                ...toIdFilters('keywords', query.keywordIds, (id) => labels.keyword.get(id) ?? `Keyword ${id}`),
                ...toIdFilters('companies', query.companyIds, (id) => labels.company.get(id) ?? `Company ${id}`),
                visible.yearRange && (query.yearFrom !== null || query.yearTo !== null)
                    ? {
                          id: 'year-range',
                          label:
                              query.yearFrom !== null && query.yearTo !== null
                                  ? `Years: ${query.yearFrom}-${query.yearTo}`
                                  : query.yearFrom !== null
                                    ? `From ${query.yearFrom}`
                                    : `Until ${query.yearTo}`,
                          group: 'yearRange' as const,
                          clearParams: { yearFrom: null, yearTo: null },
                      }
                    : null,
                visible.watchRegion && query.watchRegion !== defaultRegion
                    ? {
                          id: 'watch-region',
                          label: `Region: ${findLabel(regionOptions, query.watchRegion) ?? query.watchRegion}`,
                          group: 'watchRegion' as const,
                          clearParams: { watchRegion: null, providers: null },
                      }
                    : null,
                visible.certification && query.certification
                    ? {
                          id: 'certification',
                          label: `Rated ${query.certification}`,
                          group: 'certification' as const,
                          clearParams: { certification: null },
                      }
                    : null,
                visible.releaseType && query.releaseType !== null
                    ? {
                          id: 'release-type',
                          label: `Release: ${findLabel(MOVIE_RELEASE_TYPE_FILTER_OPTIONS, query.releaseType) ?? query.releaseType}`,
                          group: 'releaseType' as const,
                          clearParams: { releaseType: null },
                      }
                    : null,
                visible.language && query.originalLanguage
                    ? {
                          id: 'language',
                          label: `Language: ${findLabel(languageOptions, query.originalLanguage) ?? query.originalLanguage.toUpperCase()}`,
                          group: 'language' as const,
                          clearParams: { language: null },
                      }
                    : null,
                visible.rating && query.voteAverageGte !== null
                    ? {
                          id: 'rating',
                          label: `${query.voteAverageGte}+ rating`,
                          group: 'rating' as const,
                          clearParams: { rating: null },
                      }
                    : null,
                visible.votes && query.voteCountGte !== null
                    ? {
                          id: 'votes',
                          label: `${query.voteCountGte}+ votes`,
                          group: 'votes' as const,
                          clearParams: { votes: toVoteCountParam(null, definition) },
                      }
                    : null,
                visible.runtime && query.runtimePreset !== 'any'
                    ? {
                          id: 'runtime',
                          label: findLabel(RUNTIME_FILTER_OPTIONS, query.runtimePreset) ?? 'Runtime',
                          group: 'runtime' as const,
                          clearParams: { runtime: null },
                      }
                    : null,
            ].filter(isDefined);
            const moreActiveCount = activeFilters.filter(({ group }) => MORE_FILTER_GROUPS.includes(group)).length;
            // The default vote count and genre exclusion show as chips but only count as changes once removed.
            const hasChangedDefaults =
                (visible.votes && query.voteCountGte !== (definition?.defaultVoteCountGte ?? null)) ||
                (!!definition?.defaultGenreExclusion && query.excludedGenreIds.length === 0);
            const hasMore = results.state === 'success' && page < totalPages;
            const filters = {
                activeFilterCount: activeFilters.length,
                hasActiveFilters: activeFilters.length > 0,
                moreActiveCount,
                hasMoreActiveFilters: moreActiveCount > 0,
                hasMoreFilters: MORE_FILTER_GROUPS.some((group) => visible[group]),
                visible,
                showWhereToWatch: visible.providers || visible.watchRegion,
                genreOptions: [...genreMap.entries()]
                    .filter(([value]) => !query.excludedGenreIds.includes(value))
                    .map(([value, label]) => ({ label, value }))
                    .sort((left, right) => left.label.localeCompare(right.label)),
                selectedGenreIds: query.genreIds,
                keywordSuggestions: state.suggestions.keyword,
                companySuggestions: state.suggestions.company,
                yearFrom: query.yearFrom,
                yearTo: query.yearTo,
                yearMin: MIN_YEAR,
                yearMax: MAX_YEAR,
                yearStart: new Date().getFullYear(),
                watchRegionOptions: regionOptions,
                watchRegion: query.watchRegion,
                providerOptions: state.providerOptions,
                hasProviderOptions: state.providerOptions.length > 0,
                selectedProviderIds: query.providerIds,
                certificationOptions: [
                    ANY_CERTIFICATION_OPTION,
                    ...(state.certifications[query.watchRegion] ??
                        state.certifications[CERTIFICATION_FALLBACK_REGION] ??
                        []),
                ],
                certification: query.certification,
                releaseTypeOptions: MOVIE_RELEASE_TYPE_FILTER_OPTIONS,
                releaseType: query.releaseType,
                languageOptions: filterOptionsByQuery(languageOptions, state.languageSearch),
                language: query.originalLanguage,
                ratingOptions: RATING_FILTER_OPTIONS,
                rating: query.voteAverageGte,
                voteCountOptions: VOTE_COUNT_FILTER_OPTIONS,
                voteCount: query.voteCountGte,
                runtimeOptions: RUNTIME_FILTER_OPTIONS,
                runtime: query.runtimePreset,
            };

            return {
                title: definition?.mode === 'advanced' ? ADVANCED_TITLES[query.mediaType] : (definition?.title ?? ''),
                subtitle: definition?.subtitle ?? '',
                showMediaTypeToggle: definition?.mode === 'advanced',
                mediaType: query.mediaType,
                mediaTypeOptions: MEDIA_TYPE_OPTIONS,
                showSort: !!definition?.showSort,
                sortKey: query.sortKey,
                sortDirection: query.sortDirection,
                sortOptions: getTmdbDiscoverSortOptions(query.mediaType),
                showFilters: Object.values(visible).some(Boolean),
                filters,
                lockedFilters: definition?.lockedFilters ?? [],
                activeFilters,
                showReset:
                    activeFilters.some(({ id }) => id !== 'votes' && id !== 'excluded-genres') || hasChangedDefaults,
                showResultCount: hasRemoteData(results),
                resultCountLabel: pluralize(state.totalResults, singularNoun, pluralNoun),
                showEmptyState: results.state === 'success' && items.length === 0,
                displayItems: items.map((item) => ({
                    item: mediaListItemToCardItem(item),
                    libraryState: toLibraryState(state.libraryStates, item),
                })),
                skeletonCount:
                    results.state === 'loading'
                        ? PAGE_SIZE
                        : results.state === 'loading-more'
                          ? LOADING_MORE_SKELETON_COUNT
                          : 0,
                showMore: hasMore || results.state === 'loading-more',
                isLoadingMore: results.state === 'loading-more',
            };
        },
    );

    private readonly lookups: Record<LookupKey, DiscoverLookup> = {
        keyword: {
            param: 'keywords',
            selectedIds: (query) => query.keywordIds,
            search: (text) => this.searchRestControllerService.searchKeyword({ query: text, page: 1 }),
            details: (keywordId) => this.keywordRestControllerService.keywordDetails({ keywordId }),
            toLabel: (keyword) => keyword.name,
        },
        company: {
            param: 'companies',
            selectedIds: (query) => query.companyIds,
            search: (text) => this.searchRestControllerService.searchCompany({ query: text, page: 1 }),
            details: (companyId) => this.companyRestControllerService.companyDetails({ companyId }),
            toLabel: (company) => formatCompanyName(company.name, company.origin_country),
        },
    };

    private readonly searchKeywords = this.lookupSearch('keyword');

    private readonly searchCompanies = this.lookupSearch('company');

    private readonly loadResults = this.effect<DiscoverRequest | null>((request$) =>
        request$.pipe(
            switchMap((request) => {
                if (!request) {
                    this.router.navigate(['/not-found']);
                    return EMPTY;
                }

                const { definition, visible, query } = request;

                this.patchState({
                    definition,
                    visible,
                    query,
                    defaultRegion: request.defaultRegion,
                    page: 0,
                    totalPages: 0,
                    totalResults: 0,
                    results: { state: 'loading' },
                    suggestions: { keyword: [], company: [] },
                });

                return merge(
                    this.fetchPage$(definition, query, 1),
                    this.watchProviderStoreService
                        .providers$(query.mediaType, query.watchRegion)
                        .pipe(
                            tap((providers) =>
                                this.patchState({
                                    providerOptions: providers.map(({ id, name }) => ({ value: id, label: name })),
                                }),
                            ),
                        ),
                    this.fetchLabels$('keyword', query.keywordIds),
                    this.fetchLabels$('company', query.companyIds),
                );
            }),
        ),
    );

    private readonly loadCertifications = this.effect<unknown>((trigger$) =>
        trigger$.pipe(
            switchMap(() =>
                this.certificationRestControllerService.certificationMovieList().pipe(
                    tap(({ certifications }) =>
                        this.patchState({
                            certifications: Object.fromEntries(
                                Object.entries(certifications ?? {}).map(([region, entries]) => [
                                    region,
                                    entries
                                        .filter(
                                            (entry): entry is typeof entry & { certification: string } =>
                                                !!entry.certification,
                                        )
                                        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
                                        .map(({ certification }) => ({ label: certification, value: certification })),
                                ]),
                            ),
                        }),
                    ),
                    // Without certifications the filter only offers "Any certification".
                    catchError(() => EMPTY),
                ),
            ),
        ),
    );

    private readonly setLibraryStates = this.effect<MediaStateLookup | null>((libraryStates$) =>
        libraryStates$.pipe(tap((libraryStates) => this.patchState({ libraryStates }))),
    );

    constructor(
        private activatedRoute: ActivatedRoute,
        private router: Router,
        private tmdbDiscoverService: TmdbDiscoverService,
        private certificationRestControllerService: CertificationRestControllerService,
        private companyRestControllerService: CompanyRestControllerService,
        private keywordRestControllerService: KeywordRestControllerService,
        private searchRestControllerService: SearchRestControllerService,
        private watchProviderStoreService: WatchProviderStoreService,
        private configStoreService: ConfigStoreService,
        private genreService: GenreService,
        localeStoreService: LocaleStoreService,
        userLibraryService: UserLibraryService,
    ) {
        super(INITIAL_STATE);

        this.loadResults(
            combineLatest({
                data: activatedRoute.data,
                queryParams: activatedRoute.queryParamMap,
                defaultRegion: localeStoreService.region$,
            }).pipe(
                map(({ data, queryParams, defaultRegion }) => {
                    const definition =
                        Object.values(DISCOVER_PAGE_DEFINITIONS).find(({ key }) => key === data['discoverPageKey']) ??
                        null;

                    if (!definition) {
                        return null;
                    }

                    const mediaType =
                        definition.mode === 'advanced'
                            ? parseEnumParam(
                                  queryParams.get('type'),
                                  MEDIA_TYPE_OPTIONS.map(({ value }) => value),
                                  definition.mediaType,
                              )
                            : definition.mediaType;
                    const isMovie = mediaType === 'movie';
                    const visible: DiscoverFilterVisibility = {
                        ...definition.filters,
                        // Certification and release type are movie-only filters.
                        certification: definition.filters.certification && isMovie,
                        releaseType: definition.filters.releaseType && isMovie,
                    };
                    const votesParam = queryParams.get('votes');
                    const voteCountGte =
                        !visible.votes || votesParam === 'any'
                            ? null
                            : (parsePositiveNumberParam(votesParam) ?? definition.defaultVoteCountGte ?? null);
                    const query: DiscoverQueryState = {
                        mediaType,
                        watchRegion: visible.watchRegion
                            ? parseRegionParam(queryParams.get('watchRegion'), defaultRegion)
                            : defaultRegion,
                        sortKey: definition.showSort
                            ? parseEnumParam(
                                  queryParams.get('sort'),
                                  TMDB_DISCOVER_SORT_KEYS,
                                  definition.defaultSortKey,
                              )
                            : definition.defaultSortKey,
                        sortDirection: definition.showSort
                            ? parseEnumParam(
                                  queryParams.get('direction'),
                                  SORT_DIRECTIONS,
                                  definition.defaultSortDirection,
                              )
                            : definition.defaultSortDirection,
                        genreIds: visible.genres ? parsePositiveIntegerListParam(queryParams.get('genres')) : [],
                        excludedGenreIds:
                            definition.defaultGenreExclusion && queryParams.get('exclude') !== 'none'
                                ? definition.defaultGenreExclusion.genreIds
                                : [],
                        keywordIds: visible.keywords ? parsePositiveIntegerListParam(queryParams.get('keywords')) : [],
                        companyIds: visible.companies
                            ? parsePositiveIntegerListParam(queryParams.get('companies'))
                            : [],
                        providerIds: visible.providers
                            ? parsePositiveIntegerListParam(queryParams.get('providers'))
                            : [],
                        yearFrom: visible.yearRange
                            ? parseBoundedIntegerParam(queryParams.get('yearFrom'), MIN_YEAR, MAX_YEAR)
                            : null,
                        yearTo: visible.yearRange
                            ? parseBoundedIntegerParam(queryParams.get('yearTo'), MIN_YEAR, MAX_YEAR)
                            : null,
                        certification: visible.certification
                            ? parseStringParam(queryParams.get('certification'))
                            : null,
                        releaseType:
                            definition.lockedReleaseType ??
                            (visible.releaseType
                                ? (MOVIE_RELEASE_TYPE_FILTER_OPTIONS.find(
                                      ({ value }) =>
                                          value !== null && String(value) === queryParams.get('releaseType'),
                                  )?.value ?? null)
                                : null),
                        originalLanguage: visible.language ? parseLanguageParam(queryParams.get('language')) : null,
                        voteAverageGte: visible.rating ? parsePositiveNumberParam(queryParams.get('rating')) : null,
                        voteCountGte: definition.lockedVoteCountGte ?? voteCountGte,
                        runtimePreset: visible.runtime
                            ? parseEnumParam(
                                  queryParams.get('runtime'),
                                  RUNTIME_FILTER_OPTIONS.map(({ value }) => value),
                                  'any',
                              )
                            : 'any',
                    };
                    const request: DiscoverRequest = {
                        definition,
                        visible,
                        query,
                        defaultRegion,
                        requestKey: JSON.stringify({ key: definition.key, query, defaultRegion }),
                    };

                    return request;
                }),
                distinctUntilChanged((previous, current) => previous?.requestKey === current?.requestKey),
            ),
        );
        this.loadCertifications(this.select(({ visible }) => visible.certification).pipe(filter(Boolean), take(1)));
        this.setLibraryStates(userLibraryService.mediaStates$(this.select((state) => remoteData(state.results, []))));
    }

    loadMore$(): Observable<unknown> {
        const { definition, query, results, page, totalPages } = this.get();

        if (!definition || results.state !== 'success' || page >= totalPages) {
            return EMPTY;
        }

        this.patchState({ results: { state: 'loading-more', data: results.data } });
        return this.fetchPage$(definition, query, page + 1);
    }

    setMediaType(mediaType: MediaType): void {
        this.navigate({
            type: mediaType,
            genres: null,
            providers: null,
            certification: null,
            releaseType: null,
        });
    }

    setSortKey(sortKey: TmdbDiscoverSortKey): void {
        this.navigate({ sort: sortKey });
    }

    toggleSortDirection(): void {
        this.navigate({ direction: this.get().query.sortDirection === 'asc' ? 'desc' : 'asc' });
    }

    updateFilter(change: DiscoverFilterChange): void {
        const { definition, query, defaultRegion } = this.get();

        switch (change.key) {
            case 'keywordSearch':
                this.searchKeywords(change.value);
                return;
            case 'companySearch':
                this.searchCompanies(change.value);
                return;
            case 'languageSearch':
                return this.patchState({ languageSearch: change.value });
            case 'keyword':
            case 'company': {
                const lookup = this.lookups[change.key];
                const label = this.get().suggestions[change.key].find(({ value }) => value === change.value)?.label;

                if (label) {
                    this.addLabels(change.key, [[change.value, label]]);
                }

                this.setSuggestions(change.key, []);
                return this.navigate({
                    [lookup.param]: serializeNumberListParam([
                        ...new Set([...lookup.selectedIds(query), change.value]),
                    ]),
                });
            }
            case 'genres':
            case 'providers':
                return this.navigate({ [change.key]: serializeNumberListParam(change.value) });
            case 'yearFrom':
            case 'yearTo': {
                // Years can be typed freely, so anything that isn't a positive number clears the bound.
                const year = change.value !== null && Number.isFinite(change.value) && change.value > 0 ? change.value : null;
                const yearFrom = change.key === 'yearFrom' ? year : query.yearFrom;
                const yearTo = change.key === 'yearTo' ? year : query.yearTo;
                const isReversed = yearFrom !== null && yearTo !== null && yearFrom > yearTo;

                return this.navigate({
                    yearFrom: isReversed ? yearTo : yearFrom,
                    yearTo: isReversed ? yearFrom : yearTo,
                });
            }
            case 'watchRegion':
                return this.navigate({
                    watchRegion: change.value === defaultRegion ? null : change.value,
                    providers: null,
                });
            case 'certification':
            case 'language':
            case 'releaseType':
            case 'rating':
                return this.navigate({ [change.key]: change.value });
            case 'votes':
                return this.navigate({ votes: toVoteCountParam(change.value, definition) });
            case 'runtime':
                return this.navigate({ runtime: change.value === 'any' ? null : change.value });
        }
    }

    clearFilter(filter: DiscoverActiveFilter): void {
        this.navigate(filter.clearParams);
    }

    /** Clears every query param, keeping only a media type the advanced page was switched to. */
    resetFilters(): void {
        const { definition, query } = this.get();

        this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams:
                definition?.mode === 'advanced' && query.mediaType !== definition.mediaType
                    ? { type: query.mediaType }
                    : {},
        });
    }

    /** A page is replaced on a new request and appended on "show more". */
    private fetchPage$(definition: DiscoverPageDefinition, query: DiscoverQueryState, page: number) {
        const windowDays = definition.dateWindow ? DATE_WINDOW_DAYS[definition.dateWindow] : null;
        const runtime = RUNTIME_RANGES[query.runtimePreset];

        return this.tmdbDiscoverService
            .discover$({
                mediaType: query.mediaType,
                sortKey: query.sortKey,
                sortDirection: query.sortDirection,
                page,
                watchRegion: query.watchRegion,
                genreIds: query.genreIds,
                excludedGenreIds: query.excludedGenreIds,
                keywordIds: query.keywordIds,
                companyIds: query.companyIds,
                providerIds: query.providerIds,
                originalLanguage: query.originalLanguage,
                certification: query.certification,
                releaseType: query.releaseType,
                // Date-window pages filter by release dates; every other page by the year range of first releases.
                releaseDates: windowDays
                    ? { from: getISODate(windowDays[0]), to: getISODate(windowDays[1]) }
                    : undefined,
                firstReleaseDates: windowDays
                    ? undefined
                    : {
                          from: query.yearFrom ? `${query.yearFrom}-01-01` : undefined,
                          to: query.yearTo ? `${query.yearTo}-12-31` : undefined,
                      },
                runtimeMin: runtime.min,
                runtimeMax: runtime.max,
                voteAverageMin: query.voteAverageGte,
                voteCountMin: query.voteCountGte,
            })
            .pipe(
            tap((response) => {
                // A "show more" page that lands after the filters changed belongs to the previous list.
                if (this.get().query !== query) {
                    return;
                }

                const items = (response.results ?? []).map((item) => toMediaListItem(item, query.mediaType, 'full'));

                this.patchState(({ results }) => {
                    const loaded = results.state === 'loading-more' ? results.data : [];
                    const loadedIds = new Set(loaded.map(({ id }) => id));

                    return {
                        page: response.page ?? page,
                        totalPages: response.total_pages ?? 0,
                        totalResults: response.total_results ?? 0,
                        results: remoteSuccess([...loaded, ...items.filter(({ id }) => !loadedIds.has(id))]),
                    };
                });
            }),
            // A failed first page shows the empty state; a failed "show more" keeps what is already listed.
            catchError(() => {
                if (this.get().query === query) {
                    this.patchState(({ results }) => ({ results: remoteSuccess(remoteData(results, [])) }));
                }

                return EMPTY;
            }),
        );
    }

    /** Names for the selected ids not named yet, so the active filter chips show names instead of ids. */
    private fetchLabels$(key: LookupKey, ids: readonly number[]): Observable<unknown> {
        const lookup = this.lookups[key];
        const known = this.get().labels[key];

        return forkJoin(
            ids
                .filter((id) => !known.has(id))
                .map((id) =>
                    lookup.details(id).pipe(
                        // A chip whose name fails to load falls back to showing its id.
                        catchError(() => of(null)),
                    ),
                ),
        ).pipe(
            tap((entities) =>
                this.addLabels(
                    key,
                    toNamedOptions(entities.filter(isDefined), lookup.toLabel).map(({ value, label }) => [
                        value,
                        label,
                    ]),
                ),
            ),
        );
    }

    private addLabels(key: LookupKey, entries: readonly (readonly [number, string])[]): void {
        this.patchState((state) => ({
            labels: { ...state.labels, [key]: new Map([...state.labels[key], ...entries]) },
        }));
    }

    private lookupSearch(key: LookupKey) {
        return this.effect<string>((text$) =>
            text$.pipe(
                debounceTime(250),
                map((text) => text.trim()),
                distinctUntilChanged(),
                switchMap((text) => {
                    const lookup = this.lookups[key];

                    if (text.length < MIN_LOOKUP_QUERY_LENGTH) {
                        this.setSuggestions(key, []);
                        return EMPTY;
                    }

                    return lookup.search(text).pipe(
                        tap(({ results }) => {
                            const selectedIds = lookup.selectedIds(this.get().query);

                            this.setSuggestions(
                                key,
                                toNamedOptions(results ?? [], lookup.toLabel)
                                    .filter(({ value }) => !selectedIds.includes(value))
                                    .slice(0, MAX_LOOKUP_SUGGESTIONS),
                            );
                        }),
                        // Suggestions are optional; a failed search just offers none.
                        catchError(() => {
                            this.setSuggestions(key, []);
                            return EMPTY;
                        }),
                    );
                }),
            ),
        );
    }

    private setSuggestions(key: LookupKey, suggestions: readonly SelectOption<number>[]): void {
        this.patchState((state) => ({ suggestions: { ...state.suggestions, [key]: suggestions } }));
    }

    private navigate(queryParams: Record<string, string | number | null>): void {
        this.router.navigate([], { relativeTo: this.activatedRoute, queryParams, queryParamsHandling: 'merge' });
    }
}

/** Pages with a default vote count store "any" when it is cleared and nothing when it matches the default. */
const toVoteCountParam = (
    voteCount: number | null,
    definition: DiscoverPageDefinition | null,
): string | number | null => {
    const defaultVoteCount = definition?.defaultVoteCountGte ?? null;

    if (voteCount === null) {
        return defaultVoteCount !== null ? 'any' : null;
    }

    return voteCount === defaultVoteCount ? null : voteCount;
};

const toNamedOptions = (
    entities: readonly NamedResult[],
    toLabel: (entity: NamedResult & { readonly name: string }) => string,
): SelectOption<number>[] =>
    entities.filter(hasIdAndName).map((entity) => ({ value: entity.id, label: toLabel(entity) }));
