import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    distinctUntilChanged,
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
    TrendingRestControllerService,
    TvSeriesRestControllerService,
    VideoList,
} from '../../../api';
import { RatingControllerService, WatchlistControllerService } from '../../../api-cinekeep';
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
    getCurrentMonthName,
    getISODate,
    isDefined,
    isMediaResult,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    pickBestYoutubeTrailer,
    RemoteData,
    remoteData,
    remoteSuccess,
    STREAMING_THIS_MONTH_SLUG,
    TmdbDiscoverService,
    toCardItem,
    toMediaListItem,
    toRating,
    toSnapshotCardItem,
    toSnapshotMediaListItem,
    toStreamingPreviewQueries,
    toStreamingThisMonthQuery,
    UserSessionStoreService,
    WatchProviderStoreService,
    whenSuccess$,
} from '../../../shared';
import { SpotlightItem, toSpotlightItem } from '../hero-spotlight/hero-spotlight.component';

export interface HomeRatedTitle {
    readonly item: MediaListItem;
    readonly score: number;
}

export interface HomeLibrary {
    readonly isLoading: boolean;
    readonly watchlistColumns: number;
    readonly ratingsSkeletonCount: number;
    readonly watchlist: CardItem[];
    readonly ratings: HomeRatedTitle[];
    readonly showWatchlistEmpty: boolean;
    readonly showRatingsEmpty: boolean;
}

export interface OpeningSoonDay {
    readonly date: string;
    readonly items: CardItem[];
}

interface HomeState {
    readonly spotlight: RemoteData<SpotlightItem | null>;
    readonly spotlightTrailerUrl: string | null;
    readonly watchlist: RemoteData<CardItem[]>;
    readonly ratings: RemoteData<HomeRatedTitle[]>;
    readonly popularMediaType: MediaType;
    readonly popular: RemoteData<Record<MediaType, MediaListItem[]>>;
    readonly streamingArrivals: RemoteData<CardItem[]>;
    readonly airingToday: RemoteData<MediaListItem[]>;
    readonly openingSoon: RemoteData<CardItem[]>;
}

const TOP_PICKS_COUNT = MEDIUM_LIST_COUNT;
const LIBRARY_WATCHLIST_COUNT = 4;
const LIBRARY_RATINGS_COUNT = 3;
const STREAMING_SHELF_COUNT = 6;
const AIRING_TONIGHT_COUNT = 6;
const OPENING_SOON_COUNT = 6;

const INITIAL_STATE: HomeState = {
    spotlight: { state: 'notAsked' },
    spotlightTrailerUrl: null,
    watchlist: { state: 'notAsked' },
    ratings: { state: 'notAsked' },
    popularMediaType: 'movie',
    popular: { state: 'notAsked' },
    streamingArrivals: { state: 'notAsked' },
    airingToday: { state: 'notAsked' },
    openingSoon: { state: 'notAsked' },
};

@Injectable()
export class HomeStoreService extends ComponentStore<HomeState> {
    readonly home$ = this.select(
        this.state$,
        this.userSessionStoreService.authSession$,
        (state, session) => {
            const watchlist = remoteData(state.watchlist, []);
            const ratings = remoteData(state.ratings, []);
            const isLibraryLoading = state.watchlist.state === 'loading' || state.ratings.state === 'loading';
            const airingTonight = remoteData(state.airingToday, []).slice(0, AIRING_TONIGHT_COUNT);
            const streamingArrivals = remoteData(state.streamingArrivals, []);
            const openingSoon = remoteData(state.openingSoon, [])
                .filter(({ backdropPath }) => !!backdropPath)
                .slice(0, OPENING_SOON_COUNT);
            const month = getCurrentMonthName();

            return {
                spotlight: remoteData(state.spotlight, null),
                showSpotlightSkeleton: state.spotlight.state !== 'success',
                spotlightTrailerUrl: state.spotlightTrailerUrl,
                // The server can't know the session, so it renders neither block and the browser picks one.
                showLibrary: session.resolved && session.isAuthenticated,
                showAccountInvite: session.resolved && !session.isAuthenticated,
                library: {
                    isLoading: isLibraryLoading,
                    watchlistColumns: LIBRARY_WATCHLIST_COUNT,
                    ratingsSkeletonCount: LIBRARY_RATINGS_COUNT,
                    watchlist,
                    ratings,
                    showWatchlistEmpty: !isLibraryLoading && watchlist.length === 0,
                    showRatingsEmpty: !isLibraryLoading && ratings.length === 0,
                } satisfies HomeLibrary,
                popularMediaType: state.popularMediaType,
                popularMediaTypeOptions: MEDIA_TYPE_OPTIONS,
                isPopularLoading: state.popular.state === 'loading',
                topPicks: (remoteData(state.popular, null)?.[state.popularMediaType] ?? []).map((item, index) => ({
                    item,
                    rank: index + 1,
                })),
                streamingTitle: `New on streaming in ${month}`,
                streamingLinkLabel: `All ${month} arrivals`,
                streamingLink: ['/watch', 'streaming', 'list', STREAMING_THIS_MONTH_SLUG],
                // A series' first-air year says nothing about the season arriving now, so these cards show none.
                streamingArrivals: streamingArrivals.map((item) => ({ ...item, date: '' })),
                streamingColumns: STREAMING_SHELF_COUNT,
                showStreamingSkeleton: state.streamingArrivals.state !== 'success',
                showStreamingEmpty: state.streamingArrivals.state === 'success' && streamingArrivals.length === 0,
                airingTonight,
                showAiringSkeleton: state.airingToday.state !== 'success',
                airingSkeletonCount: AIRING_TONIGHT_COUNT,
                showAiringEmpty: state.airingToday.state === 'success' && airingTonight.length === 0,
                openingSoonDays: [...new Set(openingSoon.map(({ date }) => date))].sort().map(
                    (date): OpeningSoonDay => ({ date, items: openingSoon.filter((item) => item.date === date) }),
                ),
                showOpeningSoonSkeleton: state.openingSoon.state !== 'success',
                showOpeningSoonEmpty: state.openingSoon.state === 'success' && openingSoon.length === 0,
            };
        },
        { debounce: true },
    );

    constructor(
        private movieListRestControllerService: MovieListRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private trendingRestControllerService: TrendingRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
        private ratingControllerService: RatingControllerService,
        private watchlistControllerService: WatchlistControllerService,
        private localeStoreService: LocaleStoreService,
        private tmdbDiscoverService: TmdbDiscoverService,
        private userSessionStoreService: UserSessionStoreService,
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
            popular: { state: 'loading' },
            streamingArrivals: { state: 'loading' },
            airingToday: { state: 'loading' },
            openingSoon: { state: 'loading' },
        });

        return merge(
            this.trendingRestControllerService.trendingAll({ timeWindow: 'day' }).pipe(
                map(({ results }) => (results ?? []).filter(isMediaResult)),
                // Without trending titles the page shows no spotlight.
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

                    this.patchState({ spotlight: remoteSuccess(spotlight && toSpotlightItem(spotlight)) });

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
            this.userSessionStoreService.settledIsAuthenticated$.pipe(
                distinctUntilChanged(),
                switchMap((isAuthenticated) => {
                    if (!isAuthenticated) {
                        this.patchState({ watchlist: { state: 'notAsked' }, ratings: { state: 'notAsked' } });
                        return EMPTY;
                    }

                    this.patchState({ watchlist: { state: 'loading' }, ratings: { state: 'loading' } });

                    return merge(
                        this.watchlistControllerService
                            .getWatchlist({ page: 0, size: LIBRARY_WATCHLIST_COUNT, sortDirection: 'desc' })
                            .pipe(
                                map(({ content }) =>
                                    (content ?? [])
                                        .map((item) => toSnapshotCardItem(item, toRating(item.voteAverage)))
                                        .filter(isDefined),
                                ),
                                // An unreadable watchlist shows the same prompt as an empty one.
                                catchError(() => of([])),
                                tap((watchlist) => this.patchState({ watchlist: remoteSuccess(watchlist) })),
                            ),
                        this.ratingControllerService
                            .getRatings({ page: 0, size: LIBRARY_RATINGS_COUNT, sortDirection: 'desc' })
                            .pipe(
                                map(({ content }) =>
                                    (content ?? [])
                                        .map((rating) => {
                                            const item = toSnapshotMediaListItem(rating, toRating(rating.voteAverage));
                                            const thumb = rating.backdropPath ?? item?.thumb ?? null;

                                            return item && rating.value
                                                ? { item: { ...item, thumb }, score: rating.value }
                                                : null;
                                        })
                                        .filter(isDefined),
                                ),
                                // Unreadable ratings show the same prompt as having none yet.
                                catchError(() => of([])),
                                tap((ratings) => this.patchState({ ratings: remoteSuccess(ratings) })),
                            ),
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
            whenSuccess$(this.watchProviderStoreService.regionProviders$).pipe(
                switchMap(({ tvProviders }) =>
                    this.tmdbDiscoverService.preview$(
                        toStreamingPreviewQueries(toStreamingThisMonthQuery(tvProviders)),
                        STREAMING_SHELF_COUNT,
                    ),
                ),
                tap((streamingArrivals) => this.patchState({ streamingArrivals: remoteSuccess(streamingArrivals) })),
            ),
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
                        (results ?? [])
                            .map((item) => toCardItem(item, 'movie'))
                            // Re-releases match the theatrical window but carry their original premiere date,
                            // which would file them under a day that has already passed.
                            .filter(({ date }) => date >= today)
                            .slice(0, PAGE_SIZE),
                    ),
                    // A failed request shows the "nothing opening" empty state.
                    catchError(() => of([])),
                    tap((openingSoon) => this.patchState({ openingSoon: remoteSuccess(openingSoon) })),
                ),
        );
    }

    setPopularMediaType(popularMediaType: MediaType): void {
        this.patchState({ popularMediaType });
    }
}
