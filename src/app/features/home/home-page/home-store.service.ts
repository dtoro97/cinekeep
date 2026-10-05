import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    EMPTY,
    forkJoin,
    map,
    merge,
    Observable,
    of,
    switchMap,
    tap,
} from 'rxjs';

import {
    MovieListRestControllerService,
    MovieRestControllerService,
    PersonListRestControllerService,
    TrendingRestControllerService,
    TvSeriesRestControllerService,
    VideoList,
} from '../../../api';
import {
    CURATED_TV_EXCLUDED_GENRE_IDS,
    DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
    DEFAULT_DISCOVER_VOTE_COUNT_GTE,
    MEDIUM_LIST_COUNT,
    OPENING_SOON_MOVIE_DAYS_AHEAD,
    PAGE_SIZE,
    THEATRICAL_MOVIE_RELEASE_TYPE,
} from '../../../constants';
import {
    buildYoutubeWatchUrl,
    CardItem,
    DISCOVER_PREVIEW_COUNT,
    getCurrentMonthName,
    getISODate,
    isMediaResult,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    PersonCardItem,
    pickBestYoutubeTrailer,
    RemoteData,
    remoteData,
    remoteSuccess,
    STREAMING_THIS_MONTH_SLUG,
    TmdbDiscoverService,
    toCardItem,
    toMediaListItem,
    toPersonCardItem,
    toStreamingPreviewQueries,
    toStreamingThisMonthQuery,
    WatchProviderStoreService,
    whenSuccess$,
} from '../../../shared';
import { SpotlightItem, toSpotlightItem } from '../hero-spotlight/hero-spotlight.component';

interface HomeState {
    readonly spotlight: RemoteData<SpotlightItem | null>;
    readonly spotlightTrailerUrl: string | null;
    readonly trendingToday: RemoteData<CardItem[]>;
    readonly popularMediaType: MediaType;
    readonly popular: RemoteData<Record<MediaType, MediaListItem[]>>;
    readonly airingToday: RemoteData<MediaListItem[]>;
    readonly popularPeople: RemoteData<PersonCardItem[]>;
    readonly streamingArrivals: RemoteData<CardItem[]>;
    readonly openingSoon: RemoteData<CardItem[]>;
}

const TOP_PICKS_COUNT = MEDIUM_LIST_COUNT;
const AIRING_PREVIEW_MAX_ITEMS = 12;
// The airing grid runs three columns on desktop and two on tablet; multiples of six fill both.
const AIRING_PREVIEW_ROW_UNIT = 6;

const INITIAL_STATE: HomeState = {
    spotlight: { state: 'notAsked' },
    spotlightTrailerUrl: null,
    trendingToday: { state: 'notAsked' },
    popularMediaType: 'movie',
    popular: { state: 'notAsked' },
    airingToday: { state: 'notAsked' },
    popularPeople: { state: 'notAsked' },
    streamingArrivals: { state: 'notAsked' },
    openingSoon: { state: 'notAsked' },
};

@Injectable()
export class HomeStoreService extends ComponentStore<HomeState> {
    readonly home$ = this.select((state) => {
        const airing = remoteData(state.airingToday, []).slice(0, AIRING_PREVIEW_MAX_ITEMS);
        const fullRowsCount = airing.length - (airing.length % AIRING_PREVIEW_ROW_UNIT);
        const airingPreview = fullRowsCount ? airing.slice(0, fullRowsCount) : airing;
        const streamingArrivals = remoteData(state.streamingArrivals, []);
        const month = getCurrentMonthName();

        return {
            spotlight: remoteData(state.spotlight, null),
            showSpotlightSkeleton: state.spotlight.state !== 'success',
            spotlightTrailerUrl: state.spotlightTrailerUrl,
            trendingToday: state.trendingToday,
            popularMediaType: state.popularMediaType,
            popularMediaTypeOptions: MEDIA_TYPE_OPTIONS,
            isPopularLoading: state.popular.state === 'loading',
            topPicks: (remoteData(state.popular, null)?.[state.popularMediaType] ?? []).map((item, index) => ({
                item,
                rank: index + 1,
            })),
            airingPreview,
            showAiringSkeleton: state.airingToday.state !== 'success',
            airingSkeletonCount: AIRING_PREVIEW_ROW_UNIT,
            showAiringEmpty: state.airingToday.state === 'success' && airingPreview.length === 0,
            popularPeople: state.popularPeople,
            streamingArrivals,
            streamingTitle: `What's streaming in ${month}`,
            streamingCtaLabel: `Browse ${month} TV series arrivals`,
            streamingLink: ['/watch', 'streaming', 'list', STREAMING_THIS_MONTH_SLUG],
            showStreamingSkeleton: state.streamingArrivals.state !== 'success',
            streamingSkeletonCount: DISCOVER_PREVIEW_COUNT,
            showStreamingEmpty: state.streamingArrivals.state === 'success' && streamingArrivals.length === 0,
            openingSoon: state.openingSoon,
        };
    });

    constructor(
        private movieListRestControllerService: MovieListRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private personListRestControllerService: PersonListRestControllerService,
        private trendingRestControllerService: TrendingRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
        private localeStoreService: LocaleStoreService,
        private tmdbDiscoverService: TmdbDiscoverService,
        private watchProviderStoreService: WatchProviderStoreService,
    ) {
        super(INITIAL_STATE);
    }

    /** Loads every section side by side; each one shows its own skeleton until it lands. */
    load$(): Observable<unknown> {
        const today = getISODate(0);
        const region = this.localeStoreService.region();

        this.patchState({
            spotlight: { state: 'loading' },
            trendingToday: { state: 'loading' },
            popular: { state: 'loading' },
            airingToday: { state: 'loading' },
            popularPeople: { state: 'loading' },
            streamingArrivals: { state: 'loading' },
            openingSoon: { state: 'loading' },
        });

        return merge(
            this.trendingRestControllerService.trendingAll({ timeWindow: 'day' }).pipe(
                map(({ results }) => (results ?? []).filter(isMediaResult)),
                // Without trending titles the page shows no spotlight and an empty trending row.
                catchError(() => of([])),
                switchMap((items) => {
                    const candidates = items.filter(({ backdrop_path }) => !!backdrop_path);
                    // An FNV-1a hash of the day and the titles picks the same spotlight all day, on the
                    // server and in the browser, and a new one the next day.
                    const seed = `${today}:${candidates.map(({ media_type, id }) => `${media_type}:${id}`).join('|')}`;
                    const hash = [...seed].reduce(
                        (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
                        2166136261,
                    );
                    const picked = candidates[(hash >>> 0) % candidates.length];
                    const spotlight = picked?.id ? toCardItem(picked, picked.media_type) : null;

                    this.patchState({
                        spotlight: remoteSuccess(spotlight && toSpotlightItem(spotlight)),
                        trendingToday: remoteSuccess(
                            items
                                .filter((item) => item !== picked)
                                .map((item) => toCardItem(item, item.media_type))
                                .slice(0, PAGE_SIZE),
                        ),
                    });

                    if (!spotlight) {
                        return EMPTY;
                    }

                    const videos$: Observable<VideoList> =
                        spotlight.mediaType === 'movie'
                            ? this.movieRestControllerService.movieVideos({ movieId: spotlight.id })
                            : this.tvSeriesRestControllerService.tvSeriesVideos({ seriesId: spotlight.id });

                    return videos$.pipe(
                        tap(({ results }) => {
                            const trailerKey = pickBestYoutubeTrailer(results ?? [])?.key;

                            this.patchState({
                                spotlightTrailerUrl: trailerKey ? buildYoutubeWatchUrl(trailerKey) : null,
                            });
                        }),
                        // Without a trailer the spotlight links to the title page instead.
                        catchError(() => EMPTY),
                    );
                }),
            ),
            forkJoin({
                movie: this.movieListRestControllerService.moviePopularList({ page: 1, region }).pipe(
                    map(({ results }) =>
                        (results ?? [])
                            .map((item) => toMediaListItem(item, 'movie', 'year'))
                            .slice(0, TOP_PICKS_COUNT),
                    ),
                    // A failed list leaves that media type's chart empty.
                    catchError(() => of([])),
                ),
                // Discover instead of the raw popular list, which is dominated by daily talk and soap programming.
                tv: this.tmdbDiscoverService
                    .discover$({
                        mediaType: 'tv',
                        sortKey: 'popularity',
                        sortDirection: 'desc',
                        voteCountMin: DEFAULT_DISCOVER_VOTE_COUNT_GTE,
                        excludedGenreIds: CURATED_TV_EXCLUDED_GENRE_IDS,
                    })
                    .pipe(
                        map(({ results }) =>
                            (results ?? [])
                                .map((item) => toMediaListItem(item, 'tv', 'year'))
                                .slice(0, TOP_PICKS_COUNT),
                        ),
                        // A failed list leaves that media type's chart empty.
                        catchError(() => of([])),
                    ),
            }).pipe(tap((popular) => this.patchState({ popular: remoteSuccess(popular) }))),
            this.tmdbDiscoverService
                .discover$({
                    mediaType: 'tv',
                    sortKey: 'popularity',
                    sortDirection: 'desc',
                    releaseDates: { from: today, to: today },
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    voteCountMin: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
                    excludedGenreIds: CURATED_TV_EXCLUDED_GENRE_IDS,
                })
                .pipe(
                    map(({ results }) =>
                        (results ?? []).map((item) => toMediaListItem(item, 'tv', 'year')).slice(0, PAGE_SIZE),
                    ),
                    // A failed request shows the "nothing airing" empty state.
                    catchError(() => of([])),
                    tap((airingToday) => this.patchState({ airingToday: remoteSuccess(airingToday) })),
                ),
            this.personListRestControllerService.personPopularList({ page: 1 }).pipe(
                map(({ results }) =>
                    (results ?? [])
                        .map(toPersonCardItem)
                        .filter(({ imagePath }) => !!imagePath)
                        .slice(0, PAGE_SIZE),
                ),
                // A failed request leaves the people carousel empty.
                catchError(() => of([])),
                tap((popularPeople) => this.patchState({ popularPeople: remoteSuccess(popularPeople) })),
            ),
            whenSuccess$(this.watchProviderStoreService.regionProviders$).pipe(
                switchMap(({ tvProviders }) =>
                    this.tmdbDiscoverService.preview$(
                        toStreamingPreviewQueries(toStreamingThisMonthQuery(tvProviders)),
                    ),
                ),
                tap((streamingArrivals) => this.patchState({ streamingArrivals: remoteSuccess(streamingArrivals) })),
            ),
            this.tmdbDiscoverService
                .discover$({
                    mediaType: 'movie',
                    sortKey: 'popularity',
                    sortDirection: 'desc',
                    releaseDates: { from: today, to: getISODate(OPENING_SOON_MOVIE_DAYS_AHEAD) },
                    releaseType: THEATRICAL_MOVIE_RELEASE_TYPE,
                })
                .pipe(
                    map(({ results }) =>
                        (results ?? []).map((item) => toCardItem(item, 'movie')).slice(0, PAGE_SIZE),
                    ),
                    // A failed request leaves the opening-soon carousel empty.
                    catchError(() => of([])),
                    tap((openingSoon) => this.patchState({ openingSoon: remoteSuccess(openingSoon) })),
                ),
        );
    }

    setPopularMediaType(popularMediaType: MediaType): void {
        this.patchState({ popularMediaType });
    }
}
