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
    share,
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
    RatingControllerService,
    RatingResponse,
    WatchlistControllerService,
    WatchlistItemResponse,
} from '../../../api-cinekeep';
import {
    CURATED_TV_EXCLUDED_GENRE_IDS,
    DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
    DEFAULT_DISCOVER_VOTE_COUNT_GTE,
    MEDIUM_LIST_COUNT,
    THEATRICAL_MOVIE_RELEASE_TYPE,
} from '../../../constants';
import {
    buildYoutubeWatchUrl,
    CardItem,
    formatEpisodeCode,
    getISODate,
    isDefined,
    isMediaResult,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    MediaStateLookup,
    MediaType,
    PersonCardItem,
    pickBestYoutubeTrailer,
    pluralize,
    RemoteData,
    remoteData,
    remoteSuccess,
    TmdbDiscoverService,
    toCardItem,
    toKnownForPersonCardItem,
    toLibraryState,
    TOP_PROVIDER_COUNT,
    UserLibraryService,
    UserSessionStoreService,
    WatchProviderStoreService,
} from '../../../shared';
import { SpotlightItem, toSpotlightItem } from '../hero-spotlight/hero-spotlight.component';
import { TrailerCardsService, TrailerVideoCardItem } from '../trailer-cards.service';

export interface WeekEpisode {
    readonly id: number;
    readonly title: string;
    readonly posterPath: string | null;
    readonly airDate: string;
    readonly episodeCode: string;
    readonly network: string;
}

export interface RecentRating {
    readonly item: CardItem;
    readonly score: number;
    readonly ratedAt: string;
}

interface HomeState {
    readonly spotlight: RemoteData<SpotlightItem | null>;
    readonly spotlightTrailerUrl: string | null;
    readonly popularMediaType: MediaType;
    readonly popular: RemoteData<Record<MediaType, CardItem[]>>;
    readonly weekFilms: RemoteData<CardItem[]>;
    readonly weekEpisodes: RemoteData<WeekEpisode[]>;
    readonly trailers: RemoteData<TrailerVideoCardItem[]>;
    readonly popularPeople: RemoteData<PersonCardItem[]>;
    readonly watchlist: RemoteData<CardItem[]>;
    readonly recentRatings: RemoteData<RecentRating[]>;
    readonly libraryStates: MediaStateLookup | null;
}

const WEEK_DAYS = 7;
// Series checked for an episode this week; each one costs a details request.
const WEEK_SERIES_COUNT = 12;
const WEEK_FILMS_PER_DAY = 3;
const WEEK_EPISODES_PER_DAY = 4;
const TRAILER_COUNT = 3;
// Trending titles tried for trailers; some have none, so a few more than are shown.
const TRAILER_SEED_COUNT = 6;
const PEOPLE_COUNT = 7;
const WATCHLIST_PREVIEW_COUNT = 6;
const RECENT_RATINGS_COUNT = 4;

const INITIAL_STATE: HomeState = {
    spotlight: { state: 'notAsked' },
    spotlightTrailerUrl: null,
    popularMediaType: 'movie',
    popular: { state: 'notAsked' },
    weekFilms: { state: 'notAsked' },
    weekEpisodes: { state: 'notAsked' },
    trailers: { state: 'notAsked' },
    popularPeople: { state: 'notAsked' },
    watchlist: { state: 'notAsked' },
    recentRatings: { state: 'notAsked' },
    libraryStates: null,
};

@Injectable()
export class HomeStoreService extends ComponentStore<HomeState> {
    readonly home$ = this.select(
        this.state$,
        this.watchProviderStoreService.regionProviders$,
        this.userSessionStoreService.authSession$,
        (state, regionProviders, authSession) => {
            const popularItems = remoteData(state.popular, null)?.[state.popularMediaType] ?? [];
            const weekFilms = remoteData(state.weekFilms, []);
            const weekEpisodes = remoteData(state.weekEpisodes, []);
            const providers = remoteData(regionProviders, null);
            const weekDays = Array.from({ length: WEEK_DAYS }, (_, offset) => {
                const isoDate = getISODate(offset);
                const films = weekFilms.filter(({ date }) => date === isoDate);
                const episodes = weekEpisodes.filter(({ airDate }) => airDate === isoDate);

                return {
                    isoDate,
                    relativeLabel: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : null,
                    filmCountLabel: films.length > WEEK_FILMS_PER_DAY ? pluralize(films.length, 'film') : null,
                    films: films.slice(0, WEEK_FILMS_PER_DAY),
                    moreFilmsLabel:
                        films.length > WEEK_FILMS_PER_DAY
                            ? `+${pluralize(films.length - WEEK_FILMS_PER_DAY, 'more film', 'more films')}`
                            : null,
                    episodes: episodes.slice(0, WEEK_EPISODES_PER_DAY),
                };
            }).filter(({ films, episodes }) => films.length > 0 || episodes.length > 0);
            const isWeekLoading = state.weekFilms.state === 'loading' || state.weekEpisodes.state === 'loading';

            return {
                spotlight: remoteData(state.spotlight, null),
                spotlightTrailerUrl: state.spotlightTrailerUrl,
                showSpotlightSkeleton: state.spotlight.state !== 'success',
                popularMediaType: state.popularMediaType,
                popularMediaTypeOptions: MEDIA_TYPE_OPTIONS,
                popularLink: state.popularMediaType === 'movie' ? '/movies/popular' : '/tv/popular',
                popularLinkLabel: state.popularMediaType === 'movie' ? 'All popular movies' : 'All popular TV series',
                popularItems: popularItems.map((item, index) => ({
                    item,
                    rank: index + 1,
                    libraryState: toLibraryState(state.libraryStates, item),
                })),
                showPopularSkeleton: state.popular.state !== 'success',
                popularSkeletonCount: MEDIUM_LIST_COUNT,
                weekDays,
                showWeekSkeleton: isWeekLoading,
                showWeekEmpty: !isWeekLoading && weekDays.length === 0,
                trailers: remoteData(state.trailers, []),
                showTrailersSkeleton: state.trailers.state !== 'success',
                trailerSkeletonCount: TRAILER_COUNT,
                providers: (providers?.tvProviders ?? []).slice(0, TOP_PROVIDER_COUNT),
                showProvidersSkeleton: regionProviders.state !== 'success',
                people: remoteData(state.popularPeople, []),
                showPeopleSkeleton: state.popularPeople.state !== 'success',
                peopleSkeletonCount: PEOPLE_COUNT,
                showLibraryInvite: authSession.resolved && !authSession.isAuthenticated,
                showLibrary: authSession.isAuthenticated,
                watchlist: remoteData(state.watchlist, []),
                showWatchlistSkeleton: state.watchlist.state === 'loading',
                showWatchlistEmpty: state.watchlist.state === 'success' && state.watchlist.data.length === 0,
                watchlistSkeletonCount: WATCHLIST_PREVIEW_COUNT,
                recentRatings: remoteData(state.recentRatings, []),
                showRatingsSkeleton: state.recentRatings.state === 'loading',
                showRatingsEmpty: state.recentRatings.state === 'success' && state.recentRatings.data.length === 0,
                ratingsSkeletonCount: RECENT_RATINGS_COUNT,
            };
        },
        { debounce: true },
    );

    constructor(
        private movieListRestControllerService: MovieListRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private personListRestControllerService: PersonListRestControllerService,
        private trendingRestControllerService: TrendingRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
        private ratingControllerService: RatingControllerService,
        private watchlistControllerService: WatchlistControllerService,
        private localeStoreService: LocaleStoreService,
        private tmdbDiscoverService: TmdbDiscoverService,
        private trailerCardsService: TrailerCardsService,
        private userLibraryService: UserLibraryService,
        private userSessionStoreService: UserSessionStoreService,
        private watchProviderStoreService: WatchProviderStoreService,
    ) {
        super(INITIAL_STATE);
    }

    // Loads every block side by side; each one shows its own skeleton until it lands.
    load$(): Observable<unknown> {
        const today = getISODate(0);
        const weekEnd = getISODate(WEEK_DAYS - 1);
        const region = this.localeStoreService.region();

        this.patchState({
            spotlight: { state: 'loading' },
            popular: { state: 'loading' },
            weekFilms: { state: 'loading' },
            weekEpisodes: { state: 'loading' },
            trailers: { state: 'loading' },
            popularPeople: { state: 'loading' },
        });

        const trending$ = this.trendingRestControllerService.trendingAll({ timeWindow: 'day' }).pipe(
            map(({ results }) => (results ?? []).filter(isMediaResult)),
            // Without trending titles the page shows no spotlight and no trailers.
            catchError(() => of([])),
            map((items) => {
                const candidates = items.filter(({ backdrop_path }) => !!backdrop_path);
                // An FNV-1a hash of the day and the titles picks the same spotlight all day, on the
                // server and in the browser, and a new one the next day.
                const seed = `${today}:${candidates.map(({ media_type, id }) => `${media_type}:${id}`).join('|')}`;
                const hash = [...seed].reduce(
                    (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
                    2166136261,
                );
                const picked = candidates[(hash >>> 0) % candidates.length];

                return {
                    spotlight: picked?.id ? toCardItem(picked, picked.media_type) : null,
                    others: items.filter((item) => item !== picked).map((item) => toCardItem(item, item.media_type)),
                };
            }),
            share(),
        );

        return merge(
            trending$.pipe(
                switchMap(({ spotlight }) => {
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
                        // Without a trailer the spotlight offers its details page only.
                        catchError(() => EMPTY),
                    );
                }),
            ),
            trending$.pipe(
                switchMap(({ others }) =>
                    this.trailerCardsService.videoCards$(others.filter(({ id }) => id > 0).slice(0, TRAILER_SEED_COUNT)),
                ),
                tap((trailers) => this.patchState({ trailers: remoteSuccess(trailers.slice(0, TRAILER_COUNT)) })),
            ),
            forkJoin({
                movie: this.movieListRestControllerService.moviePopularList({ page: 1, region }).pipe(
                    map(({ results }) =>
                        (results ?? []).map((item) => toCardItem(item, 'movie')).slice(0, MEDIUM_LIST_COUNT),
                    ),
                    // A failed list leaves that media type's wall empty.
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
                            (results ?? []).map((item) => toCardItem(item, 'tv')).slice(0, MEDIUM_LIST_COUNT),
                        ),
                        // A failed list leaves that media type's wall empty.
                        catchError(() => of([])),
                    ),
            }).pipe(tap((popular) => this.patchState({ popular: remoteSuccess(popular) }))),
            this.tmdbDiscoverService
                .discover$({
                    mediaType: 'movie',
                    sortKey: 'popularity',
                    sortDirection: 'desc',
                    releaseDates: { from: today, to: weekEnd },
                    releaseType: THEATRICAL_MOVIE_RELEASE_TYPE,
                })
                .pipe(
                    // Results carry the primary release date, which can fall outside the regional window.
                    map(({ results }) =>
                        (results ?? [])
                            .map((item) => toCardItem(item, 'movie'))
                            .filter(({ id, date }) => id > 0 && date >= today && date <= weekEnd),
                    ),
                    // A failed request leaves the cinema column empty.
                    catchError(() => of([])),
                    tap((weekFilms) => this.patchState({ weekFilms: remoteSuccess(weekFilms) })),
                ),
            this.tmdbDiscoverService
                .discover$({
                    mediaType: 'tv',
                    sortKey: 'popularity',
                    sortDirection: 'desc',
                    releaseDates: { from: today, to: weekEnd },
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    voteCountMin: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
                    excludedGenreIds: CURATED_TV_EXCLUDED_GENRE_IDS,
                })
                .pipe(
                    map(({ results }) =>
                        (results ?? []).filter(({ id }) => !!id).slice(0, WEEK_SERIES_COUNT),
                    ),
                    // A failed request leaves the episode column empty.
                    catchError(() => of([])),
                    switchMap((series) =>
                        series.length === 0
                            ? of([])
                            : forkJoin(
                                  series.map(({ id }) =>
                                      this.tvSeriesRestControllerService.tvSeriesDetails({ seriesId: id! }).pipe(
                                          map((details) => {
                                              // An episode that aired today is the latest one, not the next.
                                              const episode = [details.last_episode_to_air, details.next_episode_to_air].find(
                                                  (candidate) =>
                                                      !!candidate?.air_date &&
                                                      candidate.air_date >= today &&
                                                      candidate.air_date <= weekEnd,
                                              );

                                              return episode?.air_date
                                                  ? {
                                                        id: id!,
                                                        title: details.name ?? '',
                                                        posterPath: details.poster_path ?? null,
                                                        airDate: episode.air_date,
                                                        episodeCode: formatEpisodeCode(
                                                            episode.season_number ?? 0,
                                                            episode.episode_number ?? 0,
                                                        ),
                                                        network: details.networks?.[0]?.name ?? '',
                                                    }
                                                  : null;
                                          }),
                                          // A series whose details fail is left out of the week.
                                          catchError(() => of(null)),
                                      ),
                                  ),
                              ).pipe(map((episodes) => episodes.filter(isDefined))),
                    ),
                    tap((weekEpisodes) => this.patchState({ weekEpisodes: remoteSuccess(weekEpisodes) })),
                ),
            this.personListRestControllerService.personPopularList({ page: 1 }).pipe(
                map(({ results }) =>
                    (results ?? [])
                        .map(toKnownForPersonCardItem)
                        .filter(({ imagePath }) => !!imagePath)
                        .slice(0, PEOPLE_COUNT),
                ),
                // A failed request leaves the people wall empty.
                catchError(() => of([])),
                tap((popularPeople) => this.patchState({ popularPeople: remoteSuccess(popularPeople) })),
            ),
            this.userLibraryService
                .mediaStates$(
                    this.select((state) => remoteData(state.popular, null)).pipe(
                        filter(isDefined),
                        map(({ movie, tv }) => [...movie, ...tv]),
                    ),
                )
                .pipe(tap((libraryStates) => this.patchState({ libraryStates }))),
            this.userSessionStoreService.settledIsAuthenticated$.pipe(
                switchMap((isAuthenticated) => {
                    if (!isAuthenticated) {
                        this.patchState({ watchlist: { state: 'notAsked' }, recentRatings: { state: 'notAsked' } });
                        return EMPTY;
                    }

                    this.patchState({ watchlist: { state: 'loading' }, recentRatings: { state: 'loading' } });

                    return merge(
                        this.watchlistControllerService
                            .getWatchlist({ page: 0, size: WATCHLIST_PREVIEW_COUNT, sortDirection: 'desc' })
                            .pipe(
                                map(({ content }) =>
                                    (content ?? [])
                                        .filter(({ tmdbId, mediaType }) => !!tmdbId && !!mediaType)
                                        .map(toLibraryCardItem),
                                ),
                                // A failed request shows the watchlist as empty instead of failing the page.
                                catchError(() => of([])),
                                tap((watchlist) => this.patchState({ watchlist: remoteSuccess(watchlist) })),
                            ),
                        this.ratingControllerService
                            .getRatings({ page: 0, size: RECENT_RATINGS_COUNT, sortDirection: 'desc' })
                            .pipe(
                                map(({ content }) =>
                                    (content ?? [])
                                        .filter(({ tmdbId, mediaType, value }) => !!tmdbId && !!mediaType && !!value)
                                        .map((entry) => ({
                                            item: toLibraryCardItem(entry),
                                            score: entry.value!,
                                            ratedAt: entry.updatedAt ?? entry.ratedAt ?? '',
                                        })),
                                ),
                                // A failed request shows no recent ratings instead of failing the page.
                                catchError(() => of([])),
                                tap((recentRatings) => this.patchState({ recentRatings: remoteSuccess(recentRatings) })),
                            ),
                    );
                }),
            ),
        );
    }

    setPopularMediaType(popularMediaType: MediaType): void {
        this.patchState({ popularMediaType });
    }
}

// A saved library entry as a poster card; entries without an id and type are filtered out first.
const toLibraryCardItem = (entry: WatchlistItemResponse | RatingResponse): CardItem => ({
    id: entry.tmdbId ?? 0,
    mediaType: entry.mediaType ?? 'movie',
    title: entry.title ?? '',
    imagePath: entry.posterPath ?? null,
    backdropPath: entry.backdropPath ?? null,
    rating: entry.voteAverage ?? null,
    date: entry.releaseDate ?? '',
    overview: entry.overview ?? '',
});
