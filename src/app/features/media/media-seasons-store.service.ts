import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';

import {
    Movie,
    TvEpisode,
    TvSeason,
    TvSeasonCompact,
    TvSeasonRestControllerService,
    TvSeries,
    VideoList,
} from '../../api';
import {
    EpisodeListItemData,
    isDefined,
    mapRemoteData,
    type MediaListItemBadge,
    RemoteData,
    remoteData,
    remoteSuccess,
    toRating,
} from '../../shared';
import { toEpisodeListItem } from './episode-list-item.mapper';
import { MediaStoreService } from './media-store.service';

export interface EpisodeListEntry {
    readonly id: string;
    /** The season's highest-rated episode. */
    readonly isBest: boolean;
    /** Accessible name, e.g. "Episode 8: Better Call Saul"; used by the season ratings strip. */
    readonly label: string;
    readonly item: EpisodeListItemData;
}

export interface SeasonTarget {
    readonly seriesId: number;
    readonly seasonNumber: number;
}

/** A season's details, posters and videos, which always load together. */
interface SeasonResources {
    readonly season: TvSeason | null;
    readonly videos: VideoList | null;
}

interface MediaSeasonsState {
    readonly seriesId: number | null;
    readonly selectedTarget: SeasonTarget | null;
    readonly resourcesByKey: Readonly<Record<string, RemoteData<SeasonResources>>>;
}

const HIGHEST_RATED_BADGES: readonly MediaListItemBadge[] = [{ label: 'Highest rated', variant: 'outline' }];

const LOADING_STATE: RemoteData<never> = { state: 'loading' };

const INITIAL_STATE: MediaSeasonsState = {
    seriesId: null,
    selectedTarget: null,
    resourcesByKey: {},
};

@Injectable()
export class MediaSeasonsStoreService extends ComponentStore<MediaSeasonsState> {
    /**
     * The selected season, from its loaded details or, until they arrive, the series' season list.
     * Resources not requested yet show as loading, because opening the season requests them.
     */
    readonly season$ = this.select(
        this.state$,
        this.mediaStore.mediaState$,
        ({ seriesId, selectedTarget: target, resourcesByKey }, media) => {
            const series = seriesId ? toSeries(seriesId, media) : null;
            const seasonOptions = (series?.seasons ?? [])
                .filter((season): season is TvSeasonCompact & { season_number: number } =>
                    isDefined(season.season_number),
                )
                .sort((left, right) => left.season_number - right.season_number)
                .map((season) => ({
                    label: toSeasonLabel(season.season_number, season.name),
                    value: season.season_number,
                }));
            const resources: RemoteData<SeasonResources> =
                (target && resourcesByKey[toSeasonKey(target)]) || LOADING_STATE;

            if (!target) {
                return {
                    seasonNumber: null,
                    summary: null,
                    seasonOptions,
                    episodes: LOADING_STATE,
                    videos: LOADING_STATE,
                };
            }

            const compact = series?.seasons?.find((season) => season.season_number === target.seasonNumber);
            const season: Omit<TvSeason | TvSeasonCompact, 'episodes'> =
                resources.state === 'success' && resources.data.season
                    ? resources.data.season
                    : (compact ?? { season_number: target.seasonNumber, name: toSeasonLabel(target.seasonNumber) });
            const episodes = mapRemoteData(resources, (data) => data.season?.episodes ?? []);
            const compactCount =
                'episode_count' in season && typeof season.episode_count === 'number' ? season.episode_count : 0;
            const loadedCount = remoteData(episodes, []).length;

            return {
                seasonNumber: target.seasonNumber,
                summary: {
                    seasonNumber: target.seasonNumber,
                    name: toSeasonLabel(target.seasonNumber, season.name),
                    episodeCount: episodes.state === 'success' ? loadedCount || compactCount || 5 : compactCount || 5,
                    airDate: season.air_date ?? null,
                    overview: season.overview ?? '',
                    posterPath: season.poster_path ?? null,
                    voteAverage: toRating(season.vote_average),
                },
                seasonOptions,
                episodes: mapRemoteData(episodes, (items): EpisodeListEntry[] => {
                    const ratedEpisodes = items.filter((episode) => (episode.vote_average ?? 0) > 0);
                    const topRatedEpisode = ratedEpisodes.length
                        ? ratedEpisodes.reduce((best, episode) => {
                              const currentRating = episode.vote_average ?? 0;
                              const bestRating = best.vote_average ?? 0;

                              if (currentRating !== bestRating) {
                                  return currentRating > bestRating ? episode : best;
                              }

                              return (episode.vote_count ?? 0) > (best.vote_count ?? 0) ? episode : best;
                          })
                        : null;

                    return items.map((episode) => ({
                        isBest: episode === topRatedEpisode,
                        label: `Episode ${episode.episode_number ?? ''}: ${episode.name ?? 'Untitled episode'}`,
                        id: [
                            episode.season_number ?? 'season',
                            episode.episode_number ?? 'episode',
                            episode.id ?? episode.name ?? 'unknown',
                        ].join('-'),
                        item: toEpisodeListItem(episode, target.seriesId, {
                            fallbackSeasonNumber: target.seasonNumber,
                            badges: episode === topRatedEpisode ? HIGHEST_RATED_BADGES : undefined,
                        }),
                    }));
                }),
                videos: mapRemoteData(resources, (data) => data.videos),
            };
        },
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly tvSeasonService: TvSeasonRestControllerService,
    ) {
        super(INITIAL_STATE);
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

    /** Opens the series' default season once the series has loaded. */
    openSeries$(seriesId: number): Observable<unknown> {
        if (this.get().seriesId !== seriesId) {
            this.setState({ ...INITIAL_STATE, seriesId });
        } else {
            this.patchState({ selectedTarget: null });
        }

        return this.mediaStore.mediaState$.pipe(
            map((media) => toSeries(seriesId, media)),
            filter(isDefined),
            take(1),
            switchMap((series) => {
                const seasonNumbers = (series.seasons ?? []).map((season) => season.season_number).filter(isDefined);
                // Season 1 when the series has one, otherwise its lowest season (often 0, the specials).
                const seasonNumber = seasonNumbers.includes(1)
                    ? 1
                    : seasonNumbers.length
                      ? Math.min(...seasonNumbers)
                      : null;

                return seasonNumber === null ? EMPTY : this.openSeason$({ seriesId, seasonNumber });
            }),
        );
    }

    openSeason$(target: SeasonTarget): Observable<unknown> {
        const { seriesId, selectedTarget, resourcesByKey } = this.get();

        if (seriesId !== target.seriesId) {
            this.setState({ ...INITIAL_STATE, seriesId: target.seriesId, selectedTarget: target });
        } else if (selectedTarget?.seasonNumber !== target.seasonNumber) {
            this.patchState({ selectedTarget: target });
        }

        const key = toSeasonKey(target);
        const current = seriesId === target.seriesId ? resourcesByKey[key] : undefined;

        if (current?.state === 'success' || current?.state === 'loading') {
            return EMPTY;
        }

        this.patchResources(key, { state: 'loading' });

        return forkJoin({
            season: this.fetchSeasonDetails$(target),
            videos: this.tvSeasonService
                .tvSeasonVideos(target)
                // Videos are optional, so a failure shows the season without them.
                .pipe(catchError(() => of({ results: [] }))),
        }).pipe(tap((resources) => this.patchResources(key, remoteSuccess(resources))));
    }

    private patchResources(key: string, resources: RemoteData<SeasonResources>): void {
        this.patchState((state) => ({
            resourcesByKey: { ...state.resourcesByKey, [key]: resources },
        }));
    }

    private fetchSeasonDetails$(target: SeasonTarget): Observable<TvSeason | null> {
        return (
            this.tvSeasonService
                .tvSeasonDetails(target)
                // Without the details the season still renders from the series' season list.
                .pipe(catchError(() => of(null)))
        );
    }
}

/** The season's own name, or `Specials` for season 0 and `Season N` otherwise. */
export const toSeasonLabel = (seasonNumber: number, name?: string | null): string =>
    name ?? (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);

const toSeasonKey = (target: SeasonTarget): string => `${target.seriesId}:${target.seasonNumber}`;

const toSeries = (seriesId: number, media: RemoteData<Movie | TvSeries | null>): TvSeries | null =>
    media.state === 'success' && media.data && 'seasons' in media.data && media.data.id === seriesId
        ? media.data
        : null;
