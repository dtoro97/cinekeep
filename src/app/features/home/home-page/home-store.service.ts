import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    EMPTY,
    filter,
    forkJoin,
    map,
    merge,
    Observable,
    of,
    switchMap,
    take,
    tap,
} from 'rxjs';

import {
    DiscoverRestControllerService,
    MovieListRestControllerService,
    MovieRestControllerService,
    PersonListRestControllerService,
    TrendingRestControllerService,
    TvSeriesRestControllerService,
    VideoList,
} from '../../../api';
import {
    CURATED_TV_EXCLUDED_GENRES,
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
    isMediaResult,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    PersonCardItem,
    pickBestYoutubeTrailer,
    pickDailySeededItem,
    RemoteData,
    remoteData,
    remoteSuccess,
    STREAMING_THIS_MONTH_SLUG,
    StreamingQueryService,
    toCardItem,
    toMediaListItem,
    toPersonCardItem,
    toStreamingThisMonthQuery,
    toTmdbMovieDiscoverSort,
    toTmdbTvDiscoverSort,
    WatchProviderStoreService,
} from '../../../shared';
import type { SpotlightItem } from '../hero-spotlight/hero-spotlight.component';

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

const MEDIA_TYPE_LABELS: Record<MediaType, string> = { movie: 'Movie', tv: 'TV series' };

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
            showAiringEmpty: state.airingToday.state === 'success' && airingPreview.length === 0,
            popularPeople: state.popularPeople,
            streamingArrivals,
            streamingTitle: `What's streaming in ${month}`,
            streamingCtaLabel: `Browse ${month} TV series arrivals`,
            streamingLink: ['/watch', 'streaming', 'list', STREAMING_THIS_MONTH_SLUG],
            showStreamingSkeleton: state.streamingArrivals.state !== 'success',
            showStreamingEmpty: state.streamingArrivals.state === 'success' && streamingArrivals.length === 0,
            openingSoon: state.openingSoon,
        };
    });

    constructor(
        private discoverRestControllerService: DiscoverRestControllerService,
        private movieListRestControllerService: MovieListRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private personListRestControllerService: PersonListRestControllerService,
        private trendingRestControllerService: TrendingRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
        private localeStoreService: LocaleStoreService,
        private streamingQueryService: StreamingQueryService,
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
                    const picked = pickDailySeededItem(
                        items.filter(({ backdrop_path }) => !!backdrop_path),
                        'home-trending-spotlight',
                        (item) => `${item.media_type}:${item.id ?? ''}`,
                    );
                    const spotlight = picked?.id ? toCardItem(picked, picked.media_type) : null;

                    this.patchState({
                        spotlight: remoteSuccess(
                            spotlight && {
                                id: spotlight.id,
                                mediaType: spotlight.mediaType,
                                title: spotlight.title,
                                overview: spotlight.overview,
                                backdropPath: spotlight.backdropPath,
                                rating: spotlight.rating,
                                year: spotlight.date.slice(0, 4),
                                mediaTypeLabel: MEDIA_TYPE_LABELS[spotlight.mediaType],
                            },
                        ),
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
                tv: this.discoverRestControllerService
                    .discoverTv({
                        includeAdult: false,
                        page: 1,
                        sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
                        voteCountGte: DEFAULT_DISCOVER_VOTE_COUNT_GTE,
                        withoutGenres: CURATED_TV_EXCLUDED_GENRES,
                    })
                    .pipe(
                        map(({ results }) =>
                            (results ?? []).map((item) => toMediaListItem(item, 'tv', 'year')).slice(0, TOP_PICKS_COUNT),
                        ),
                        // A failed list leaves that media type's chart empty.
                        catchError(() => of([])),
                    ),
            }).pipe(tap((popular) => this.patchState({ popular: remoteSuccess(popular) }))),
            this.discoverRestControllerService
                .discoverTv({
                    airDateGte: today,
                    airDateLte: today,
                    includeAdult: false,
                    page: 1,
                    sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    voteCountGte: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
                    withoutGenres: CURATED_TV_EXCLUDED_GENRES,
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
            this.watchProviderStoreService.catalog$.pipe(
                filter(({ loaded }) => loaded),
                take(1),
                switchMap(({ tvProviders }) =>
                    this.streamingQueryService.preview$(toStreamingThisMonthQuery(tvProviders)),
                ),
                tap((streamingArrivals) => this.patchState({ streamingArrivals: remoteSuccess(streamingArrivals) })),
            ),
            this.discoverRestControllerService
                .discoverMovie({
                    includeAdult: false,
                    page: 1,
                    region,
                    releaseDateGte: today,
                    releaseDateLte: getISODate(OPENING_SOON_MOVIE_DAYS_AHEAD),
                    sortBy: toTmdbMovieDiscoverSort('popularity', 'desc'),
                    withReleaseType: THEATRICAL_MOVIE_RELEASE_TYPE,
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
