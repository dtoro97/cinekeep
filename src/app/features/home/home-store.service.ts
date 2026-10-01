import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';

import {
    DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
    MEDIUM_LIST_COUNT,
    OPENING_SOON_MOVIE_DAYS_AHEAD,
    PAGE_SIZE,
    THEATRICAL_MOVIE_RELEASE_TYPE,
} from '../../constants';
import {
    DiscoverRestControllerService,
    MovieListRestControllerService,
    MultiListItem,
    PersonListRestControllerService,
    TrendingRestControllerService,
    TvSeriesListItem,
    TvSeriesListRestControllerService,
} from '../../api';
import {
    getCurrentMonthDateWindow,
    getCurrentMonthName,
    getISODate,
    RemoteData,
    LocaleStoreService,
    MEDIA_TYPE_OPTIONS,
    CardItem,
    MediaType,
    PersonCardItem,
    pickDailySeededItem,
    toCardItem,
    toTmdbMovieDiscoverSort,
    toTmdbTvDiscoverSort,
    toPersonCardItem,
} from '../../shared';
import { SpotlightItem } from './spotlight-item';
import { WatchProviderStoreService } from '../../shared/services';

type AiringTodayItem = CardItem<{
    year: string;
}>;

interface StreamingArrivalsFeature {
    readonly title: string;
    readonly description: string;
    readonly ctaLabel: string;
    readonly items: RemoteData<CardItem[]>;
}

const TOP_PICKS_MAX_ITEMS = MEDIUM_LIST_COUNT;
const TOP_PICKS_FEATURED_COUNT = 3;

interface HomeState {
    spotlight: RemoteData<SpotlightItem | null>;
    whatToWatchMovies: RemoteData<CardItem[]>;
    whatToWatchTv: RemoteData<CardItem[]>;
    selectedWhatToWatchMediaType: MediaType;
    popularPeople: RemoteData<PersonCardItem[]>;
    trendingToday: RemoteData<CardItem[]>;
    airingToday: RemoteData<AiringTodayItem[]>;
    streamingArrivals: RemoteData<CardItem[]>;
    inTheatres: RemoteData<CardItem[]>;
}

const INITIAL_STATE: HomeState = {
    spotlight: { state: 'notAsked' },
    whatToWatchMovies: { state: 'notAsked' },
    whatToWatchTv: { state: 'notAsked' },
    selectedWhatToWatchMediaType: 'movie',
    popularPeople: { state: 'notAsked' },
    trendingToday: { state: 'notAsked' },
    airingToday: { state: 'notAsked' },
    streamingArrivals: { state: 'notAsked' },
    inTheatres: { state: 'notAsked' },
};

@Injectable()
export class HomeStoreService extends ComponentStore<HomeState> {
    readonly homeVM$ = this.select((state) => ({
        spotlight: state.spotlight,
        whatToWatch: state.selectedWhatToWatchMediaType === 'movie' ? state.whatToWatchMovies : state.whatToWatchTv,
        whatToWatchLoading:
            (state.selectedWhatToWatchMediaType === 'movie' ? state.whatToWatchMovies : state.whatToWatchTv).state ===
            'loading',
        whatToWatchTopPicks: this.toTopPickGroups(
            state.selectedWhatToWatchMediaType === 'movie' ? state.whatToWatchMovies : state.whatToWatchTv,
        ),
        whatToWatchOptions: MEDIA_TYPE_OPTIONS,
        selectedWhatToWatchMediaType: state.selectedWhatToWatchMediaType,
        popularPeople: state.popularPeople,
        trendingToday: state.trendingToday,
        airingToday: state.airingToday,
        airingTonightPreview: state.airingToday.state === 'success' ? state.airingToday.data.slice(0, 12) : [],
        streamingArrivals: this.toStreamingArrivalsFeature(state.streamingArrivals),
        inTheatres: state.inTheatres,
    }));

    constructor(
        private readonly tvListService: TvSeriesListRestControllerService,
        private readonly movieListService: MovieListRestControllerService,
        private readonly discoverService: DiscoverRestControllerService,
        private readonly personListService: PersonListRestControllerService,
        private readonly trendingService: TrendingRestControllerService,
        private readonly localeStore: LocaleStoreService,
        private readonly watchProviderStore: WatchProviderStoreService,
    ) {
        super(INITIAL_STATE);
    }

    loadAllSections$() {
        return forkJoin([
            this.loadWhatToWatch$(),
            this.loadPopularPeople$(),
            this.loadTrendingToday$(),
            this.loadAiringToday$(),
            this.loadStreamingArrivals$(),
            this.loadInTheatres$(),
        ]);
    }

    setWhatToWatchMediaType(mediaType: MediaType): void {
        this.patchState({ selectedWhatToWatchMediaType: mediaType });
    }

    private loadWhatToWatch$() {
        this.patchState({
            whatToWatchMovies: { state: 'loading' },
            whatToWatchTv: { state: 'loading' },
        });

        return forkJoin({
            movies: this.movieListService
                .moviePopularList({ page: 1, region: this.localeStore.region() })
                .pipe(
                    map((response) =>
                        (response.results ?? []).map((item) => toCardItem(item, 'movie')).slice(0, TOP_PICKS_MAX_ITEMS),
                    ),
                    catchError(() => of([] as CardItem[])),
                ),
            tv: this.tvListService.tvSeriesPopularList({ page: 1 }).pipe(
                map((response) =>
                    (response.results ?? []).map((item) => toCardItem(item, 'tv')).slice(0, TOP_PICKS_MAX_ITEMS),
                ),
                catchError(() => of([] as CardItem[])),
            ),
        }).pipe(
            tap((whatToWatch) =>
                this.patchState({
                    whatToWatchMovies: { state: 'success', data: whatToWatch.movies },
                    whatToWatchTv: { state: 'success', data: whatToWatch.tv },
                }),
            ),
        );
    }

    private loadPopularPeople$() {
        this.patchState({ popularPeople: { state: 'loading' } });

        return this.personListService.personPopularList({ page: 1 }).pipe(
            map((response) => (response.results ?? []).map((item) => toPersonCardItem(item)).slice(0, PAGE_SIZE)),
            catchError(() => of([] as PersonCardItem[])),
            tap((popularPeople) =>
                this.patchState({
                    popularPeople: { state: 'success', data: popularPeople },
                }),
            ),
        );
    }

    private loadTrendingToday$() {
        this.patchState({
            spotlight: { state: 'loading' },
            trendingToday: { state: 'loading' },
        });

        return this.trendingService.trendingAll({ timeWindow: 'day' }).pipe(
            map((response) => {
                const mediaItems = (response.results ?? []).filter(
                    (item: MultiListItem) => item.media_type === 'movie' || item.media_type === 'tv',
                );

                const candidates = mediaItems.filter((item) => !!item.backdrop_path);
                const picked = pickDailySeededItem(
                    candidates,
                    'home-trending-spotlight',
                    (item) => `${item.media_type}:${item.id ?? ''}`,
                );
                const spotlight = picked ? this.toSpotlightItem(picked) : null;
                const carouselItems = mediaItems.filter((item) => item !== picked);

                return {
                    spotlight,
                    trendingToday: carouselItems
                        .map((item) =>
                            item.media_type === 'movie' ? toCardItem(item, 'movie') : toCardItem(item, 'tv'),
                        )
                        .slice(0, PAGE_SIZE),
                };
            }),
            catchError(() =>
                of({
                    spotlight: null as SpotlightItem | null,
                    trendingToday: [] as CardItem[],
                }),
            ),
            tap(({ spotlight, trendingToday }) =>
                this.patchState({
                    spotlight: { state: 'success', data: spotlight },
                    trendingToday: {
                        state: 'success',
                        data: trendingToday,
                    },
                }),
            ),
        );
    }

    private loadAiringToday$() {
        this.patchState({ airingToday: { state: 'loading' } });

        const today = getISODate(0);

        return this.discoverService
            .discoverTv({
                airDateGte: today,
                airDateLte: today,
                includeAdult: false,
                page: 1,
                sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
                timezone: this.getTimeZone(),
                voteCountGte: DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE,
            })
            .pipe(
                map((response) =>
                    (response.results ?? []).map((item) => this.toAiringTodayItem(item)).slice(0, PAGE_SIZE),
                ),
                catchError(() => of([] as AiringTodayItem[])),
                tap((airingToday) =>
                    this.patchState({
                        airingToday: {
                            state: 'success',
                            data: airingToday,
                        },
                    }),
                ),
            );
    }

    private loadStreamingArrivals$() {
        this.patchState({ streamingArrivals: { state: 'loading' } });

        const dateWindow = getCurrentMonthDateWindow();
        const region = this.localeStore.region() || 'US';

        return this.watchProviderStore.loaded$.pipe(
            filter(Boolean),
            take(1),
            switchMap(() => this.watchProviderStore.topTvProviders$.pipe(take(1))),
            switchMap((providers) => {
                const providerFilter = providers.map((provider) => provider.id).join('|') || undefined;

                return this.discoverService
                    .discoverTv({
                        airDateGte: dateWindow.from,
                        airDateLte: dateWindow.to,
                        includeAdult: false,
                        page: 1,
                        sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
                        watchRegion: region,
                        withWatchMonetizationTypes: 'flatrate',
                        withWatchProviders: providerFilter,
                    })
                    .pipe(
                        map((response) =>
                            (response.results ?? [])
                                .map((item) => toCardItem(item, 'tv'))
                                .filter((item) => !!item.imagePath)
                                .slice(0, 3),
                        ),
                        catchError(() => of([] as CardItem[])),
                    );
            }),
            tap((streamingArrivals) =>
                this.patchState({
                    streamingArrivals: {
                        state: 'success',
                        data: streamingArrivals,
                    },
                }),
            ),
        );
    }

    private loadInTheatres$() {
        this.patchState({ inTheatres: { state: 'loading' } });

        const releaseDateGte = getISODate(0);
        const releaseDateLte = getISODate(OPENING_SOON_MOVIE_DAYS_AHEAD);

        return this.discoverService
            .discoverMovie({
                includeAdult: false,
                page: 1,
                region: this.localeStore.region(),
                releaseDateGte,
                releaseDateLte,
                sortBy: toTmdbMovieDiscoverSort('popularity', 'desc'),
                withReleaseType: THEATRICAL_MOVIE_RELEASE_TYPE,
            })
            .pipe(
                map((response) =>
                    (response.results ?? []).map((item) => toCardItem(item, 'movie')).slice(0, PAGE_SIZE),
                ),
                catchError(() => of([] as CardItem[])),
                tap((inTheatres) =>
                    this.patchState({
                        inTheatres: { state: 'success', data: inTheatres },
                    }),
                ),
            );
    }

    private toSpotlightItem(item: MultiListItem): SpotlightItem | null {
        if (!item.backdrop_path || !item.id) {
            return null;
        }

        const isMovie = item.media_type === 'movie';
        const title = isMovie ? item.title : item.name;
        const date = isMovie ? item.release_date : item.first_air_date;

        return {
            id: item.id,
            mediaType: isMovie ? 'movie' : 'tv',
            title: title ?? '',
            overview: item.overview ?? '',
            backdropPath: item.backdrop_path,
            rating: item.vote_average ?? null,
            year: (date ?? '').slice(0, 4),
            mediaTypeLabel: isMovie ? 'Movie' : 'TV series',
        };
    }

    private toTopPickGroups(state: RemoteData<CardItem[]>) {
        const topPickItems =
            state.state === 'success' || state.state === 'loading-more'
                ? state.data.slice(0, TOP_PICKS_MAX_ITEMS).map((item) => ({
                      item,
                  }))
                : [];

        return {
            featured: topPickItems.slice(0, TOP_PICKS_FEATURED_COUNT),
            secondary: topPickItems.slice(TOP_PICKS_FEATURED_COUNT),
        };
    }

    private toAiringTodayItem(item: TvSeriesListItem): AiringTodayItem {
        const cardItem = toCardItem(item, 'tv');

        return {
            ...cardItem,
            year: cardItem.date.slice(0, 4),
        };
    }

    private toStreamingArrivalsFeature(items: RemoteData<CardItem[]>): StreamingArrivalsFeature {
        const month = getCurrentMonthName();

        return {
            title: `What's streaming in ${month}`,
            description: 'Popular TV series premieres and returning seasons from major streaming services.',
            ctaLabel: `Browse ${month} TV series arrivals`,
            items,
        };
    }

    private getTimeZone(): string | undefined {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
}
