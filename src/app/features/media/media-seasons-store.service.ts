import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, combineLatest, forkJoin, map, of, switchMap, tap } from 'rxjs';

import {
    TvEpisode,
    TvSeason,
    TvSeasonCompact,
    TvSeasonImages,
    TvSeasonRestControllerService,
    TvSeries,
    VideoList,
} from '../../api';
import {
    hasRemoteData,
    IMAGE_LANGUAGE_FALLBACK,
    isDefined,
    LocaleStoreService,
    mapRemoteData,
    type MediaListItemBadge,
    RemoteData,
    remoteData,
    remoteSuccess,
    RouteCommands,
    toRating,
    toVideoCardItems,
    toYoutubeVideos,
    VideoCardItem,
    ViewerImage,
} from '../../shared';
import { MediaStoreService } from './media-store.service';
import type { EpisodeListEntry } from './episode-list/episode-list.models';
import { MediaDetails } from './models/media-details.model';

export interface SeasonTarget {
    readonly seriesId: number;
    readonly seasonNumber: number;
}

const HIGHEST_RATED_BADGES: readonly MediaListItemBadge[] = [{ label: 'Highest rated', variant: 'outline' }];

type SeasonRecord = Omit<TvSeason | TvSeasonCompact, 'episodes'> & {
    episodes: RemoteData<TvEpisode[]>;
    images: RemoteData<ViewerImage[]>;
    videos: RemoteData<VideoList | null>;
};

/** A season's details, posters and videos, which always load together. */
interface SeasonResources {
    readonly season: TvSeason | null;
    readonly images: TvSeasonImages | null;
    readonly videos: VideoList | null;
}

interface MediaSeasonsState {
    readonly seriesId: number | null;
    readonly selectedTarget: SeasonTarget | null;
    readonly resourcesByKey: Readonly<Record<string, RemoteData<SeasonResources>>>;
}

const INITIAL_STATE: MediaSeasonsState = {
    seriesId: null,
    selectedTarget: null,
    resourcesByKey: {},
};

@Injectable()
export class MediaSeasonsStoreService extends ComponentStore<MediaSeasonsState> {
    private readonly seriesId$ = this.select((state) => state.seriesId);
    private readonly selectedTarget$ = this.select((state) => state.selectedTarget);
    readonly selectedSeasonNumber$ = this.selectedTarget$.pipe(map((target) => target?.seasonNumber ?? null));

    private readonly seriesState$ = this.select(
        this.seriesId$,
        this.mediaStore.mediaState$,
        (seriesId, media): RemoteData<TvSeries | null> => {
            if (!seriesId) {
                return { state: 'notAsked' };
            }

            const seriesState: RemoteData<TvSeries | null> = mapRemoteData(media, (data): TvSeries | null =>
                data && 'seasons' in data && data.id === seriesId ? data : null,
            );

            return hasRemoteData(seriesState) && !seriesState.data ? { state: 'notAsked' } : seriesState;
        },
    );

    private readonly seriesDetails$ = this.mediaStore.mediaDetailsState$.pipe(
        map((state): MediaDetails | null => (state.state === 'success' ? state.data : null)),
    );

    private readonly selectedResources$ = this.select(
        this.selectedTarget$,
        this.select((state) => state.resourcesByKey),
        (target, resourcesByKey): RemoteData<SeasonResources> =>
            (target && resourcesByKey[toSeasonKey(target)]) || { state: 'notAsked' },
    );

    private readonly selectedSeasonRecord$ = this.select(
        this.selectedTarget$,
        this.seriesState$,
        this.selectedResources$,
        (target, seriesState, resources): SeasonRecord | null =>
            this.toSelectedSeasonRecord(target, seriesState, resources),
    );

    readonly selectedSeasonSummary$ = combineLatest([this.selectedSeasonNumber$, this.selectedSeasonRecord$]).pipe(
        map(([seasonNumber, season]) =>
            isDefined(seasonNumber) ? this.toSeasonSummary(seasonNumber, season) : null,
        ),
    );

    readonly seasonEpisodesState$ = combineLatest([
        this.seriesId$,
        this.selectedSeasonNumber$,
        this.selectedSeasonRecord$,
    ]).pipe(
        map(([seriesId, selectedSeasonNumber, season]): RemoteData<EpisodeListEntry[]> =>
            this.toEpisodeListState(
                this.toVisibleResourceState(season?.episodes),
                seriesId,
                selectedSeasonNumber,
            ),
        ),
    );

    readonly seasonOptions$ = this.seriesState$.pipe(
        map((seriesState) =>
            (remoteData(seriesState, null)?.seasons ?? [])
                .filter((season): season is TvSeasonCompact & { season_number: number } =>
                    isDefined(season.season_number),
                )
                .sort((left, right) => left.season_number - right.season_number)
                .map((season) => ({
                    label: toSeasonLabel(season.season_number, season.name),
                    value: season.season_number,
                })),
        ),
    );

    readonly seasonImagesState$ = this.selectedSeasonRecord$.pipe(
        map((season): RemoteData<ViewerImage[]> => this.toVisibleResourceState(season?.images)),
    );

    readonly seasonVideosState$ = combineLatest([this.selectedSeasonRecord$, this.seriesDetails$]).pipe(
        map(([season, series]): RemoteData<VideoCardItem[]> => {
            const videos = this.toVisibleResourceState(season?.videos);
            return this.toSeasonVideoItemsState(videos, series);
        }),
    );

    private readonly defaultSeasonEffect = this.effect<TvSeries | null>((series$) =>
        series$.pipe(
            switchMap((series) => {
                const seriesId = series?.id;

                if (!series || typeof seriesId !== 'number' || !Number.isInteger(seriesId)) {
                    return of(undefined);
                }

                const selectedTarget = this.get().selectedTarget;

                if (selectedTarget?.seriesId === seriesId) {
                    return this.loadSeasonResources$(selectedTarget);
                }

                const nextSeasonNumber = this.getSelectedSeasonNumber(series, null);

                if (nextSeasonNumber === null) {
                    return of(undefined);
                }

                return this.loadSeasonResources$({ seriesId, seasonNumber: nextSeasonNumber });
            }),
        ),
    );

    readonly openSeason = this.effect<SeasonTarget>((target$) =>
        target$.pipe(switchMap((target) => this.loadSeasonResources$(target))),
    );

    constructor(
        private readonly localeStore: LocaleStoreService,
        private readonly mediaStore: MediaStoreService,
        private readonly tvSeasonService: TvSeasonRestControllerService,
    ) {
        super(INITIAL_STATE);

        this.defaultSeasonEffect(
            this.seriesState$.pipe(map((state) => (state.state === 'success' ? state.data : null))),
        );
    }

    /**
     * A season's episodes for prev/next links: reuses the season page's cache when present,
     * otherwise fetches only the season details (no posters or videos).
     */
    seasonEpisodes$(target: SeasonTarget): Observable<TvEpisode[]> {
        const cached = this.get().resourcesByKey[toSeasonKey(target)];

        if (cached?.state === 'success') {
            return of(cached.data.season?.episodes ?? []);
        }

        return this.fetchSeasonDetails$(target).pipe(map((season) => season?.episodes ?? []));
    }

    openSeries(seriesId: number): void {
        const state = this.get();

        if (state.seriesId !== seriesId) {
            this.setState({
                ...INITIAL_STATE,
                seriesId,
            });
            return;
        }

        if (state.selectedTarget) {
            this.patchState({ selectedTarget: null });
        }

        this.openDefaultSeasonFromCurrentMedia(seriesId);
    }

    private selectTarget(target: SeasonTarget): void {
        const state = this.get();

        if (state.seriesId !== target.seriesId) {
            this.setState({
                ...INITIAL_STATE,
                seriesId: target.seriesId,
                selectedTarget: target,
            });
            return;
        }

        if (isSameSeasonTarget(state.selectedTarget, target)) {
            return;
        }

        this.patchState({ selectedTarget: target });
    }

    private loadSeasonResources$(target: SeasonTarget) {
        this.selectTarget(target);

        const key = toSeasonKey(target);
        const current = this.get().resourcesByKey[key];

        if (current?.state === 'success' || current?.state === 'loading') {
            return EMPTY;
        }

        this.patchResources(key, { state: 'loading' });

        return forkJoin({
            season: this.fetchSeasonDetails$(target),
            images: this.fetchSeasonImages$(target),
            videos: this.fetchSeasonVideos$(target),
        }).pipe(tap((resources) => this.patchResources(key, remoteSuccess(resources))));
    }

    private patchResources(key: string, resources: RemoteData<SeasonResources>): void {
        this.patchState((state) => ({
            resourcesByKey: { ...state.resourcesByKey, [key]: resources },
        }));
    }

    private openDefaultSeasonFromCurrentMedia(seriesId: number): void {
        const media = this.mediaStore.currentMedia();

        if (!media || !('seasons' in media) || media.id !== seriesId) {
            return;
        }

        const seasonNumber = this.getSelectedSeasonNumber(media, null);

        if (seasonNumber !== null) {
            this.openSeason({ seriesId, seasonNumber });
        }
    }

    private fetchSeasonDetails$(target: SeasonTarget) {
        return this.tvSeasonService
            .tvSeasonDetails({ seriesId: target.seriesId, seasonNumber: target.seasonNumber })
            .pipe(
                catchError(() => {
                    return of(null);
                }),
            );
    }

    private fetchSeasonImages$(target: SeasonTarget) {
        return this.tvSeasonService
            .tvSeasonImages({
                seriesId: target.seriesId,
                seasonNumber: target.seasonNumber,
                includeImageLanguage: IMAGE_LANGUAGE_FALLBACK,
                language: this.localeStore.language(),
            })
            .pipe(
                catchError(() => {
                    return of(null);
                }),
            );
    }

    private fetchSeasonVideos$(target: SeasonTarget) {
        return this.tvSeasonService
            .tvSeasonVideos({ seriesId: target.seriesId, seasonNumber: target.seasonNumber })
            .pipe(
                catchError(() => {
                    return of({ results: [] });
                }),
            );
    }

    private toSelectedSeasonRecord(
        target: SeasonTarget | null,
        seriesState: RemoteData<TvSeries | null>,
        resources: RemoteData<SeasonResources>,
    ): SeasonRecord | null {
        if (!target) {
            return null;
        }

        const series =
            seriesState.state === 'success' && seriesState.data?.id === target.seriesId ? seriesState.data : null;
        const compact = series?.seasons?.find((season) => season.season_number === target.seasonNumber);
        const season =
            resources.state === 'success' && resources.data.season
                ? resources.data.season
                : (compact ?? {
                      season_number: target.seasonNumber,
                      name: toSeasonLabel(target.seasonNumber),
                  });

        return {
            ...season,
            episodes: mapRemoteData(resources, (data) => data.season?.episodes ?? []),
            images: mapRemoteData(resources, (data) => this.toSeasonImages(data.images?.posters ?? [])),
            videos: mapRemoteData(resources, (data) => data.videos),
        };
    }

    private toEpisodeListState(
        episodes: RemoteData<TvEpisode[]>,
        seriesId: number | null,
        selectedSeasonNumber: number | null,
    ): RemoteData<EpisodeListEntry[]> {
        return mapRemoteData(episodes, (items) => this.toEpisodeListEntries(items, seriesId, selectedSeasonNumber));
    }

    private toEpisodeListEntries(
        episodes: readonly TvEpisode[],
        seriesId: number | null,
        selectedSeasonNumber: number | null,
    ): EpisodeListEntry[] {
        const topRatedEpisode = this.getTopRatedEpisode(episodes);

        return episodes.map((episode) => ({
            isBest: episode === topRatedEpisode,
            label: `Episode ${episode.episode_number ?? ''}: ${episode.name ?? 'Untitled episode'}`,
            id: [
                episode.season_number ?? 'season',
                episode.episode_number ?? 'episode',
                episode.id ?? episode.name ?? 'unknown',
            ].join('-'),
            item: {
                name: episode.name ?? 'Untitled episode',
                subtitle: null,
                overview: episode.overview ?? '',
                stillPath: episode.still_path ?? null,
                code: null,
                episodeNumber: episode.episode_number ?? null,
                airDate: episode.air_date ?? null,
                runtime: episode.runtime ?? null,
                voteAverage: toRating(episode.vote_average),
                badges: episode === topRatedEpisode ? HIGHEST_RATED_BADGES : undefined,
                routeCommands: this.toEpisodeRouteCommands(episode, seriesId, selectedSeasonNumber),
            },
        }));
    }

    private toEpisodeRouteCommands(
        episode: TvEpisode,
        seriesId: number | null,
        selectedSeasonNumber: number | null,
    ): RouteCommands | null {
        const seasonNumber = episode.season_number ?? selectedSeasonNumber;
        const episodeNumber = episode.episode_number;

        if (!isDefined(seriesId) || !isDefined(seasonNumber) || !isDefined(episodeNumber)) {
            return null;
        }

        return ['/title', seriesId, 'tv', 'episodes', seasonNumber, episodeNumber];
    }

    private getTopRatedEpisode(episodes: readonly TvEpisode[]): TvEpisode | null {
        const ratedEpisodes = episodes.filter((episode) => (episode.vote_average ?? 0) > 0);

        if (!ratedEpisodes.length) {
            return null;
        }

        return ratedEpisodes.reduce((best, episode) => {
            const currentRating = episode.vote_average ?? 0;
            const bestRating = best.vote_average ?? 0;

            if (currentRating !== bestRating) {
                return currentRating > bestRating ? episode : best;
            }

            return (episode.vote_count ?? 0) > (best.vote_count ?? 0) ? episode : best;
        });
    }

    private toSeasonImages(posters: NonNullable<TvSeasonImages['posters']>): ViewerImage[] {
        return posters.map((image) => ({
            ...image,
            photoType: 'poster',
        }));
    }

    private toSeasonVideoItemsState(
        videos: RemoteData<VideoList | null>,
        series: MediaDetails | null,
    ): RemoteData<VideoCardItem[]> {
        return mapRemoteData(videos, (videoList) =>
            series ? toVideoCardItems(toYoutubeVideos(videoList?.results ?? []), series) : [],
        );
    }

    private toSeasonSummary(seasonNumber: number, season: SeasonRecord | null) {
        if (!season) {
            return {
                seasonNumber,
                name: toSeasonLabel(seasonNumber),
                episodeCount: 0,
                airDate: null,
                overview: '',
                posterPath: null,
                voteAverage: null,
            };
        }

        const compactCount =
            'episode_count' in season && typeof season.episode_count === 'number' ? season.episode_count : 0;
        const loadedCount = remoteData(season.episodes, []).length;
        const episodeCount =
            season.episodes.state === 'success' ? loadedCount || compactCount || 5 : compactCount || 5;

        return {
            seasonNumber,
            name: toSeasonLabel(seasonNumber, season.name),
            episodeCount,
            airDate: season.air_date ?? null,
            overview: season.overview ?? '',
            posterPath: season.poster_path ?? null,
            voteAverage: toRating(season.vote_average),
        };
    }

    private getSelectedSeasonNumber(tvSeries: TvSeries, selectedSeason: number | null): number | null {
        const seasonNumbers = [...(tvSeries.seasons ?? [])]
            .map((season) => season.season_number)
            .filter(isDefined)
            .sort((left, right) => left - right);

        if (isDefined(selectedSeason) && seasonNumbers.includes(selectedSeason)) {
            return selectedSeason;
        }

        if (seasonNumbers.includes(1)) {
            return 1;
        }

        return seasonNumbers[0] ?? null;
    }

    private toVisibleResourceState<T>(state: RemoteData<T> | undefined): RemoteData<T> {
        return !state || state.state === 'notAsked' ? { state: 'loading' } : state;
    }
}

/** The season's own name, or `Specials` for season 0 and `Season N` otherwise. */
const toSeasonLabel = (seasonNumber: number, name?: string | null): string =>
    name ?? (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);

const toSeasonKey = (target: SeasonTarget): string => `${target.seriesId}:${target.seasonNumber}`;

const isSameSeasonTarget = (left: SeasonTarget | null, right: SeasonTarget): boolean =>
    left?.seriesId === right.seriesId && left.seasonNumber === right.seasonNumber;
