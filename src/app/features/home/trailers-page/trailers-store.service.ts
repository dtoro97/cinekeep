import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    distinctUntilChanged,
    EMPTY,
    forkJoin,
    map,
    merge,
    mergeMap,
    Observable,
    of,
    switchMap,
    tap,
} from 'rxjs';

import {
    DiscoverRestControllerService,
    MovieRestControllerService,
    TrendingRestControllerService,
    TvSeasonRestControllerService,
    TvSeriesRestControllerService,
    Video,
} from '../../../api';
import { PAGE_SIZE, TRAILERS_PAGE_SEED_COUNT } from '../../../constants';
import {
    getISODate,
    isDefined,
    isMediaResult,
    pickBestYoutubeTrailer,
    RemoteData,
    remoteData,
    remoteSuccess,
    SelectOption,
    toTmdbMovieDiscoverSort,
    toTmdbTvDiscoverSort,
    toVideoCardItem,
    toVideoTrailerSeedItem,
    VideoCardItem,
    VideoTrailerSeedItem,
} from '../../../shared';
import type { SpotlightItem } from '../hero-spotlight/hero-spotlight.component';

export type TrailerFeedType = 'trending' | 'new';

type TrailerVideoCardItem = VideoCardItem & { readonly spotlight: SpotlightItem };

interface TrailerFeed {
    readonly trailers: RemoteData<TrailerVideoCardItem[]>;
    /** Titles not turned into trailer cards yet; "show more" works through them a page at a time. */
    readonly pendingSeeds: readonly VideoTrailerSeedItem[];
}

interface TrailersState {
    readonly feedType: TrailerFeedType;
    readonly feeds: Record<TrailerFeedType, TrailerFeed>;
    /** The first trending trailer, loaded on its own only while the trending feed isn't. */
    readonly featured: RemoteData<TrailerVideoCardItem | null>;
}

const FEED_OPTIONS: SelectOption<TrailerFeedType>[] = [
    { label: 'Trending trailers', value: 'trending' },
    { label: 'New trailers', value: 'new' },
];

const TRAILER_CONTENT_REGION = 'US';
const TRAILER_VIDEO_LANGUAGE = 'en';
/** "New" covers titles released within this many days either side of today. */
const NEW_TRAILER_WINDOW_DAYS = 30;

const INITIAL_STATE: TrailersState = {
    feedType: 'trending',
    feeds: {
        trending: { trailers: { state: 'notAsked' }, pendingSeeds: [] },
        new: { trailers: { state: 'notAsked' }, pendingSeeds: [] },
    },
    featured: { state: 'notAsked' },
};

@Injectable()
export class TrailersStoreService extends ComponentStore<TrailersState> {
    readonly trailers$ = this.select(({ feedType, feeds, featured }) => {
        const { trailers, pendingSeeds } = feeds[feedType];

        return {
            feedType,
            feedOptions: FEED_OPTIONS,
            featured: remoteData(feeds.trending.trailers, [])[0] ?? remoteData(featured, null),
            trailers: remoteData(trailers, []),
            skeletonCount: trailers.state === 'loading' || trailers.state === 'loading-more' ? PAGE_SIZE : 0,
            showMore: pendingSeeds.length > 0 || trailers.state === 'loading-more',
            isLoadingMore: trailers.state === 'loading-more',
            showMoreLabel: trailers.state === 'loading-more' ? 'Loading trailers' : 'Show more trailers',
        };
    });

    /** Each feed loads once per visit, so switching back to one shows it straight away. */
    private readonly loadFeed = this.effect<string | null>((feedType$) =>
        feedType$.pipe(
            mergeMap((value) => {
                const feedType = FEED_OPTIONS.find((option) => option.value === value)?.value;

                if (!feedType) {
                    this.router.navigate(['/trailers', 'trending'], { replaceUrl: true });
                    return EMPTY;
                }

                const { feeds, featured } = this.get();
                const loadsFeed = feeds[feedType].trailers.state === 'notAsked';
                const loadsFeatured = feedType !== 'trending' && featured.state === 'notAsked';

                this.patchState({ feedType, featured: loadsFeatured ? { state: 'loading' } : featured });

                if (loadsFeed) {
                    this.patchFeed(feedType, { trailers: { state: 'loading' } });
                }

                return merge(
                    loadsFeed
                        ? this.seeds$(feedType).pipe(
                              switchMap((seeds) =>
                                  this.videoCards$(seeds.slice(0, PAGE_SIZE)).pipe(
                                      tap((trailers) =>
                                          this.patchFeed(feedType, {
                                              trailers: remoteSuccess(trailers),
                                              pendingSeeds: seeds.slice(PAGE_SIZE),
                                          }),
                                      ),
                                  ),
                              ),
                          )
                        : EMPTY,
                    loadsFeatured
                        ? this.seeds$('trending').pipe(
                              switchMap((seeds) => this.videoCards$(seeds.slice(0, 1))),
                              tap(([trailer]) => this.patchState({ featured: remoteSuccess(trailer ?? null) })),
                          )
                        : EMPTY,
                );
            }),
        ),
    );

    constructor(
        private router: Router,
        private discoverRestControllerService: DiscoverRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private trendingRestControllerService: TrendingRestControllerService,
        private tvSeasonRestControllerService: TvSeasonRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
        activatedRoute: ActivatedRoute,
    ) {
        super(INITIAL_STATE);

        this.loadFeed(
            activatedRoute.paramMap.pipe(
                map((params) => params.get('feedType')),
                distinctUntilChanged(),
            ),
        );
    }

    setFeedType(feedType: TrailerFeedType): void {
        this.router.navigate(['/trailers', feedType]);
    }

    loadMore$(): Observable<unknown> {
        const { feedType, feeds } = this.get();
        const { trailers, pendingSeeds } = feeds[feedType];

        if (trailers.state !== 'success' || pendingSeeds.length === 0) {
            return EMPTY;
        }

        const loaded = trailers.data;

        this.patchFeed(feedType, { trailers: { state: 'loading-more', data: loaded } });

        return this.videoCards$(pendingSeeds.slice(0, PAGE_SIZE)).pipe(
            tap((items) =>
                this.patchFeed(feedType, {
                    trailers: remoteSuccess([...loaded, ...items]),
                    pendingSeeds: pendingSeeds.slice(PAGE_SIZE),
                }),
            ),
        );
    }

    /** The titles a feed draws its trailers from, most relevant first. */
    private seeds$(feedType: TrailerFeedType): Observable<VideoTrailerSeedItem[]> {
        const seeds$: Observable<VideoTrailerSeedItem[]> =
            feedType === 'trending'
                ? this.trendingRestControllerService.trendingAll({ timeWindow: 'day' }).pipe(
                      map(({ results }) =>
                          (results ?? [])
                              .filter(isMediaResult)
                              .map((item) => toVideoTrailerSeedItem(item, item.media_type)),
                      ),
                  )
                : forkJoin({
                      movies: this.discoverRestControllerService.discoverMovie({
                          includeAdult: false,
                          includeVideo: false,
                          page: 1,
                          primaryReleaseDateGte: getISODate(-NEW_TRAILER_WINDOW_DAYS),
                          primaryReleaseDateLte: getISODate(NEW_TRAILER_WINDOW_DAYS),
                          region: TRAILER_CONTENT_REGION,
                          sortBy: toTmdbMovieDiscoverSort('popularity', 'desc'),
                      }),
                      tv: this.discoverRestControllerService.discoverTv({
                          firstAirDateGte: getISODate(-NEW_TRAILER_WINDOW_DAYS),
                          firstAirDateLte: getISODate(NEW_TRAILER_WINDOW_DAYS),
                          includeAdult: false,
                          includeNullFirstAirDates: false,
                          page: 1,
                          sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
                      }),
                  }).pipe(
                      map(({ movies, tv }) =>
                          [
                              ...(movies.results ?? []).map((movie) => ({
                                  seed: toVideoTrailerSeedItem(movie, 'movie'),
                                  popularity: movie.popularity ?? 0,
                              })),
                              ...(tv.results ?? []).map((series) => ({
                                  seed: toVideoTrailerSeedItem(series, 'tv'),
                                  popularity: series.popularity ?? 0,
                              })),
                          ]
                              .sort((left, right) => right.popularity - left.popularity)
                              .map(({ seed }) => seed),
                      ),
                  );

        return seeds$.pipe(
            map((seeds) => seeds.filter(({ mediaId }) => mediaId > 0).slice(0, TRAILERS_PAGE_SEED_COUNT)),
            // A feed that fails to load shows no trailers.
            catchError(() => of([])),
        );
    }

    /** One card per title that has a YouTube trailer; titles without one are left out. */
    private videoCards$(seeds: readonly VideoTrailerSeedItem[]): Observable<TrailerVideoCardItem[]> {
        // forkJoin of nothing never emits, which would leave the feed loading.
        if (seeds.length === 0) {
            return of([]);
        }

        return forkJoin(
            seeds.map((seed) => {
                const seriesVideos$ = this.tvSeriesRestControllerService
                    .tvSeriesVideos({ seriesId: seed.mediaId })
                    .pipe(map(({ results }) => results ?? []));
                const videos$: Observable<Video[]> =
                    seed.mediaType === 'movie'
                        ? this.movieRestControllerService
                              .movieVideos({ movieId: seed.mediaId })
                              .pipe(map(({ results }) => results ?? []))
                        : this.tvSeriesRestControllerService.tvSeriesDetails({ seriesId: seed.mediaId }).pipe(
                              map(({ seasons }) =>
                                  Math.max(0, ...(seasons ?? []).map(({ season_number }) => season_number ?? 0)),
                              ),
                              // Without season details the series' own videos are used.
                              catchError(() => of(0)),
                              switchMap((seasonNumber) =>
                                  seasonNumber > 0
                                      ? this.tvSeasonRestControllerService
                                            .tvSeasonVideos({ seriesId: seed.mediaId, seasonNumber })
                                            .pipe(
                                                map(({ results }) =>
                                                    pickBestYoutubeTrailer(results ?? [], TRAILER_VIDEO_LANGUAGE, {
                                                        requirePreferredLanguage: true,
                                                    }),
                                                ),
                                                // The newest season's trailer is preferred, not required.
                                                catchError(() => of(null)),
                                            )
                                      : of(null),
                              ),
                              switchMap((seasonTrailer) => (seasonTrailer ? of([seasonTrailer]) : seriesVideos$)),
                          );

                return videos$.pipe(
                    // A title whose videos fail to load simply gets no card.
                    catchError(() => of<Video[]>([])),
                    map((videos) => {
                        const video = pickBestYoutubeTrailer(videos, TRAILER_VIDEO_LANGUAGE);
                        const card = video && toVideoCardItem(video, { title: seed.mediaTitle });

                        if (!card) {
                            return null;
                        }

                        return {
                            ...card,
                            contextLabel: seed.mediaTitle,
                            contextLink: ['/title', seed.mediaId, seed.mediaType],
                            spotlight: {
                                id: seed.mediaId,
                                mediaType: seed.mediaType,
                                title: seed.mediaTitle,
                                overview: seed.mediaOverview,
                                backdropPath: seed.backdropPath,
                                rating: null,
                                year: seed.mediaYear,
                                mediaTypeLabel: '',
                            },
                        };
                    }),
                );
            }),
        ).pipe(map((cards) => cards.filter(isDefined)));
    }

    private patchFeed(feedType: TrailerFeedType, patch: Partial<TrailerFeed>): void {
        this.patchState((state) => ({
            feeds: { ...state.feeds, [feedType]: { ...state.feeds[feedType], ...patch } },
        }));
    }
}
