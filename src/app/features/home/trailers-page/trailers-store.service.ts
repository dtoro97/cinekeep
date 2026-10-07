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
    MovieRestControllerService,
    TrendingRestControllerService,
    TvSeasonRestControllerService,
    TvSeriesRestControllerService,
    Video,
} from '../../../api';
import { PAGE_SIZE } from '../../../constants';
import {
    CardItem,
    getISODate,
    isDefined,
    isMediaResult,
    pickBestYoutubeTrailer,
    RemoteData,
    remoteData,
    remoteSuccess,
    SelectOption,
    TmdbDiscoverService,
    toCardItem,
    toVideoCardItem,
    VideoCardItem,
} from '../../../shared';
import { SpotlightItem, toSpotlightItem } from '../hero-spotlight/hero-spotlight.component';

export type TrailerFeedType = 'trending' | 'new';

type TrailerVideoCardItem = VideoCardItem & { readonly spotlight: SpotlightItem };

interface TrailerFeed {
    readonly trailers: RemoteData<TrailerVideoCardItem[]>;
    /** Titles not turned into trailer cards yet; "show more" works through them a page at a time. */
    readonly pendingSeeds: readonly CardItem[];
}

interface TrailersState {
    readonly feedType: TrailerFeedType;
    readonly feeds: Record<TrailerFeedType, TrailerFeed>;
    /** The first trending trailer, loaded on its own only while the trending feed isn't. */
    readonly featured: RemoteData<TrailerVideoCardItem | null>;
}

const FEED_OPTIONS: SelectOption<TrailerFeedType>[] = [
    { label: 'Trending', value: 'trending' },
    { label: 'New', value: 'new' },
];

const TRAILER_CONTENT_REGION = 'US';
const TRAILER_VIDEO_LANGUAGE = 'en';
/** Titles a feed draws from; "show more" works through them a page at a time. */
const TRAILER_SEED_COUNT = 60;
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
        const featuredTrailer = remoteData(feeds.trending.trailers, [])[0] ?? remoteData(featured, null);

        return {
            feedType,
            feedOptions: FEED_OPTIONS,
            featured: featuredTrailer,
            // The featured trailer already leads the page as the hero, so the grid leaves it out.
            trailers: remoteData(trailers, []).filter(({ id }) => id !== featuredTrailer?.id),
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
        private tmdbDiscoverService: TmdbDiscoverService,
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
    private seeds$(feedType: TrailerFeedType): Observable<CardItem[]> {
        const newWindow = { from: getISODate(-NEW_TRAILER_WINDOW_DAYS), to: getISODate(NEW_TRAILER_WINDOW_DAYS) };
        const seeds$: Observable<CardItem[]> =
            feedType === 'trending'
                ? this.trendingRestControllerService.trendingAll({ timeWindow: 'day' }).pipe(
                      map(({ results }) =>
                          (results ?? [])
                              .filter(isMediaResult)
                              .map((item) => toCardItem(item, item.media_type)),
                      ),
                  )
                : forkJoin({
                      movies: this.tmdbDiscoverService.discover$({
                          mediaType: 'movie',
                          sortKey: 'popularity',
                          sortDirection: 'desc',
                          watchRegion: TRAILER_CONTENT_REGION,
                          firstReleaseDates: newWindow,
                      }),
                      tv: this.tmdbDiscoverService.discover$({
                          mediaType: 'tv',
                          sortKey: 'popularity',
                          sortDirection: 'desc',
                          firstReleaseDates: newWindow,
                      }),
                  }).pipe(
                      map(({ movies, tv }) =>
                          [
                              ...(movies.results ?? []).map((movie) => ({
                                  seed: toCardItem(movie, 'movie'),
                                  popularity: movie.popularity ?? 0,
                              })),
                              ...(tv.results ?? []).map((series) => ({
                                  seed: toCardItem(series, 'tv'),
                                  popularity: series.popularity ?? 0,
                              })),
                          ]
                              .sort((left, right) => right.popularity - left.popularity)
                              .map(({ seed }) => seed),
                      ),
                  );

        return seeds$.pipe(
            map((seeds) => seeds.filter(({ id }) => id > 0).slice(0, TRAILER_SEED_COUNT)),
            // A feed that fails to load shows no trailers.
            catchError(() => of([])),
        );
    }

    /** One card per title that has a YouTube trailer; titles without one are left out. */
    private videoCards$(seeds: readonly CardItem[]): Observable<TrailerVideoCardItem[]> {
        // forkJoin of nothing never emits, which would leave the feed loading.
        if (seeds.length === 0) {
            return of([]);
        }

        return forkJoin(
            seeds.map((seed) => {
                const seriesVideos$ = this.tvSeriesRestControllerService
                    .tvSeriesVideos({ seriesId: seed.id })
                    .pipe(map(({ results }) => results ?? []));
                const videos$: Observable<Video[]> =
                    seed.mediaType === 'movie'
                        ? this.movieRestControllerService
                              .movieVideos({ movieId: seed.id })
                              .pipe(map(({ results }) => results ?? []))
                        : this.tvSeriesRestControllerService.tvSeriesDetails({ seriesId: seed.id }).pipe(
                              map(({ seasons }) =>
                                  Math.max(0, ...(seasons ?? []).map(({ season_number }) => season_number ?? 0)),
                              ),
                              // Without season details the series' own videos are used.
                              catchError(() => of(0)),
                              switchMap((seasonNumber) =>
                                  seasonNumber > 0
                                      ? this.tvSeasonRestControllerService
                                            .tvSeasonVideos({ seriesId: seed.id, seasonNumber })
                                            .pipe(
                                                map(({ results }) =>
                                                    pickBestYoutubeTrailer(
                                                        (results ?? []).filter(
                                                            (video) => video.iso_639_1 === TRAILER_VIDEO_LANGUAGE,
                                                        ),
                                                    ),
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
                        const card = video && toVideoCardItem(video, seed);

                        if (!card) {
                            return null;
                        }

                        return {
                            ...card,
                            mediaTitle: seed.title,
                            mediaLink: ['/title', seed.id, seed.mediaType],
                            spotlight: toSpotlightItem(seed),
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
