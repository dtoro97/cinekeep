import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    combineLatest,
    distinctUntilChanged,
    forkJoin,
    map,
    of,
    switchMap,
    tap,
} from 'rxjs';

import { TvEpisode, TvEpisodeImages, TvEpisodeRestControllerService, Video, VideoList } from '../../../api';
import { EpisodeRatingControllerService } from '../../../api-cinekeep';
import {
    LocaleStoreService,
    MediaRatingService,
    EpisodeSnapshotRequest,
    RemoteData,
    UserSessionStoreService,
    VideoCardItem,
    ViewerImage,
    IMAGE_LANGUAGE_FALLBACK,
    getISODate,
    mapRemoteData,
    normalizeRatingValue,
    remoteData,
    remoteSuccess,
    toVideoCardItems,
    toYoutubeVideos,
    toEpisodeSnapshotRequest,
    toMediaSnapshotRequest,
    toRating,
} from '../../../shared';
import { toUserRatingDisplay, UserRatingState, writeUserRating$ } from '../user-rating-state';
import { EpisodeTarget, isSameEpisodeTarget } from '../media-target';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { CreditsSummary } from '../media-credits-summary/media-credits-summary.model';
import { MediaDetails } from '../models/media-details.model';
import { toEpisodeCrewRows, toGuestCast } from './episode-credits.mapper';
import { EpisodePager, toEpisodePager } from './episode-pager.mapper';

interface EpisodeDetailState {
    readonly target: EpisodeTarget | null;
    readonly episode: RemoteData<TvEpisode | null>;
    readonly episodeImages: RemoteData<TvEpisodeImages | null>;
    readonly episodeVideos: RemoteData<VideoList | null>;
    /** The season's episodes, for the previous/next episode names. */
    readonly seasonEpisodes: RemoteData<TvEpisode[]>;
    readonly rating: UserRatingState;
}

const EMPTY_RATING_RESOURCE: UserRatingState = {
    userRating: { state: 'notAsked' },
    ratingPending: false,
};

const loadingRatingResource = (): UserRatingState => ({
    userRating: { state: 'loading' },
    ratingPending: false,
});

const INITIAL_STATE: EpisodeDetailState = {
    target: null,
    episode: { state: 'notAsked' },
    episodeImages: { state: 'notAsked' },
    episodeVideos: { state: 'notAsked' },
    seasonEpisodes: { state: 'notAsked' },
    rating: EMPTY_RATING_RESOURCE,
};

@Injectable()
export class EpisodeDetailStoreService extends ComponentStore<EpisodeDetailState> {
    private readonly target$ = this.select((state) => state.target);
    private readonly mediaState$ = this.mediaStore.mediaDetailsState$;
    private readonly episodeImagesState$ = this.select((state) => state.episodeImages);
    private readonly episodeVideosState$ = this.select((state) => state.episodeVideos);
    private readonly activeRating$ = this.select((state) => state.rating);

    readonly episodeState$ = this.select((state) => state.episode);

    readonly userRating$ = this.select(this.activeRating$, this.target$, (rating, target) =>
        toUserRatingDisplay(rating, target !== null),
    );

    readonly allStillsState$ = this.episodeImagesState$.pipe(
        map(
            (images): RemoteData<ViewerImage[]> =>
                images.state === 'notAsked'
                    ? { state: 'loading' }
                    : mapRemoteData(images, (data) => this.toEpisodeStillImages(data?.stills ?? [])),
        ),
    );

    readonly stillsState$ = this.allStillsState$.pipe(
        map((state): RemoteData<ViewerImage[]> => {
            if (state.state !== 'success') {
                return state;
            }

            return {
                state: 'success',
                data: state.data.slice(0, 12),
            };
        }),
    );

    readonly allStills$ = this.allStillsState$.pipe(map((state) => remoteData(state, [])));

    private readonly youtubeVideosState$ = this.episodeVideosState$.pipe(
        map(
            (videos): RemoteData<Video[]> =>
                videos.state === 'notAsked'
                    ? { state: 'loading' }
                    : mapRemoteData(videos, (data) => toYoutubeVideos(data?.results ?? [])),
        ),
    );

    private readonly pager$ = this.select(
        this.target$,
        this.mediaStore.mediaState$,
        this.select((state) => state.seasonEpisodes),
        (target, media, seasonEpisodes): EpisodePager | null =>
            target
                ? toEpisodePager(
                      target,
                      media.state === 'success' && media.data && 'seasons' in media.data
                          ? (media.data.seasons ?? [])
                          : [],
                      seasonEpisodes.state === 'success' ? seasonEpisodes.data : null,
                  )
                : null,
    );

    readonly episodeDetail$ = combineLatest([
        this.mediaState$,
        this.episodeState$,
        this.stillsState$,
        this.youtubeVideosState$,
        this.allStills$,
        this.userRating$,
        this.pager$,
    ]).pipe(
        map(([mediaState, episodeState, stillsState, videosState, allStills, userRating, pager]) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;
            const episode = episodeState.state === 'success' ? episodeState.data : null;
            const isLoading = episodeState.state === 'loading';
            const guestStars = episode?.guest_stars ?? [];
            const stillsTotalCount = allStills.length;
            const videoItemsState = this.toVideoItemsState(videosState, media);
            const youtubeVideoCount = videoItemsState.state === 'success' ? videoItemsState.data.length : 0;
            const airDate = episode?.air_date;
            const canRateEpisode = airDate ? airDate <= getISODate(0) : false;
            const rating = toRating(episode?.vote_average);

            return {
                media,
                episode,
                isLoading,
                canRateEpisode,
                rating,
                showRatings: rating !== null || canRateEpisode,
                userRating,
                heroImage: episode?.still_path ?? media?.backdropPath ?? null,
                episodeLabel: episode
                    ? `Season ${episode.season_number ?? ''} · Episode ${episode.episode_number ?? ''}`
                    : '',
                crewRows: toEpisodeCrewRows(episode?.crew ?? []),
                guestCast: isLoading ? { state: 'loading' } : remoteSuccess(toGuestCast(guestStars)),
                hasGuestCast: isLoading || guestStars.length > 0,
                pager,
                videosState: videoItemsState,
                videoCount: youtubeVideoCount,
                stillsState,
                stillsTotalCount,
            };
        }),
    );

    constructor(
        private readonly episodeRatingControllerService: EpisodeRatingControllerService,
        private readonly localeStore: LocaleStoreService,
        private readonly mediaRatingService: MediaRatingService,
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStore: MediaSeasonsStoreService,
        private readonly tvEpisodeService: TvEpisodeRestControllerService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super(INITIAL_STATE);
    }

    readonly load = this.effect<EpisodeTarget>((target$) =>
        target$.pipe(
            tap((target) => {
                this.setState({
                    ...INITIAL_STATE,
                    target,
                    episode: { state: 'loading' },
                    episodeImages: { state: 'loading' },
                    episodeVideos: { state: 'loading' },
                    seasonEpisodes: this.keepSeasonEpisodes(target),
                    rating: loadingRatingResource(),
                });
                this.fetchEpisodeRatingEffect(target);
                this.loadSeasonEpisodes(target);
            }),
            switchMap((target) =>
                forkJoin({
                    episode: this.fetchEpisode$(target),
                    images: this.fetchEpisodeImages$(target),
                    videos: this.fetchEpisodeVideos$(target),
                }).pipe(
                    tap(({ episode, images, videos }) => {
                        this.patchState({
                            episode: { state: 'success', data: episode },
                            episodeImages: { state: 'success', data: images },
                            episodeVideos: { state: 'success', data: videos },
                        });
                    }),
                ),
            ),
        ),
    );

    /** Loads the season's episode list once per season; moving between its episodes reuses it. */
    private readonly loadSeasonEpisodes = this.effect<EpisodeTarget>((target$) =>
        target$.pipe(
            distinctUntilChanged(
                (left, right) => left.seriesId === right.seriesId && left.seasonNumber === right.seasonNumber,
            ),
            switchMap((target) =>
                this.mediaSeasonsStore.seasonEpisodes$(target).pipe(
                    tap((episodes) => this.patchState({ seasonEpisodes: { state: 'success', data: episodes } })),
                    catchError(() => {
                        this.patchState({ seasonEpisodes: { state: 'success', data: [] } });
                        return EMPTY;
                    }),
                ),
            ),
        ),
    );

    readonly loadPhotos = this.effect<EpisodeTarget>((target$) =>
        target$.pipe(switchMap((target) => this.loadPhotos$(target))),
    );

    submitUserRating$(target: EpisodeTarget, value: number): Observable<unknown> {
        return writeUserRating$(
            this.mediaRatingService.rateEpisode$(
                target.seriesId,
                target.seasonNumber,
                target.episodeNumber,
                value,
                this.loadedEpisodeSnapshot(target),
            ),
            normalizeRatingValue(value),
            (patch) => this.patchRating(target, patch),
        );
    }

    deleteUserRating$(target: EpisodeTarget): Observable<unknown> {
        return writeUserRating$(
            this.episodeRatingControllerService.deleteEpisodeRating({
                seriesTmdbId: target.seriesId,
                seasonNumber: target.seasonNumber,
                episodeNumber: target.episodeNumber,
            }),
            null,
            (patch) => this.patchRating(target, patch),
        );
    }

    private readonly fetchEpisodeRatingEffect = this.effect<EpisodeTarget>((target$) =>
        target$.pipe(
            switchMap((target) =>
                this.userSessionStore.settledIsAuthenticated$.pipe(
                    switchMap((isAuthenticated) => this.fetchEpisodeRating$(target, isAuthenticated)),
                ),
            ),
        ),
    );

    private loadPhotos$(target: EpisodeTarget): Observable<unknown> {
        const state = this.get();

        if (
            isSameEpisodeTarget(state.target, target) &&
            state.episode.state === 'success' &&
            state.episodeImages.state === 'success'
        ) {
            return of(undefined);
        }

        this.setState({
            ...INITIAL_STATE,
            target,
            episode: { state: 'loading' },
            episodeImages: { state: 'loading' },
        });

        return forkJoin({
            episode: this.fetchEpisode$(target),
            images: this.fetchEpisodeImages$(target),
        }).pipe(
            tap(({ episode, images }) => {
                this.patchState({
                    episode: { state: 'success', data: episode },
                    episodeImages: { state: 'success', data: images },
                });
            }),
        );
    }

    /** Keeps the loaded season list when moving to another episode of the same season. */
    private keepSeasonEpisodes(target: EpisodeTarget): RemoteData<TvEpisode[]> {
        const { target: previous, seasonEpisodes } = this.get();

        return previous?.seriesId === target.seriesId && previous.seasonNumber === target.seasonNumber
            ? seasonEpisodes
            : { state: 'loading' };
    }

    private fetchEpisode$(target: EpisodeTarget): Observable<TvEpisode | null> {
        return this.tvEpisodeService
            .tvEpisodeDetails({
                seriesId: target.seriesId,
                seasonNumber: target.seasonNumber,
                episodeNumber: target.episodeNumber,
            })
            .pipe(catchError(() => of(null)));
    }

    private fetchEpisodeImages$(target: EpisodeTarget): Observable<TvEpisodeImages | null> {
        return this.tvEpisodeService
            .tvEpisodeImages({
                seriesId: target.seriesId,
                seasonNumber: target.seasonNumber,
                episodeNumber: target.episodeNumber,
                includeImageLanguage: IMAGE_LANGUAGE_FALLBACK,
                language: this.localeStore.language(),
            })
            .pipe(catchError(() => of(null)));
    }

    private fetchEpisodeVideos$(target: EpisodeTarget): Observable<VideoList | null> {
        return this.tvEpisodeService
            .tvEpisodeVideos({
                seriesId: target.seriesId,
                seasonNumber: target.seasonNumber,
                episodeNumber: target.episodeNumber,
            })
            .pipe(catchError(() => of({ results: [] })));
    }

    private fetchEpisodeRating$(target: EpisodeTarget, isAuthenticated: boolean): Observable<unknown> {
        const rating$ = isAuthenticated
            ? this.mediaRatingService.getEpisodeRating$(target.seriesId, target.seasonNumber, target.episodeNumber)
            : of(null);

        return rating$.pipe(
            tap((rating) => {
                this.patchRating(target, {
                    userRating: { state: 'success', data: rating },
                    ratingPending: false,
                });
            }),
            catchError(() => {
                this.patchRating(target, {
                    userRating: { state: 'success', data: null },
                    ratingPending: false,
                });
                return of(undefined);
            }),
        );
    }

    private loadedEpisodeSnapshot(target: EpisodeTarget): EpisodeSnapshotRequest | undefined {
        const state = this.get();
        const series = this.mediaStore.currentMediaFor({ id: target.seriesId, type: 'tv' });

        if (
            !isSameEpisodeTarget(state.target, target) ||
            state.episode.state !== 'success' ||
            !state.episode.data ||
            !series
        ) {
            return undefined;
        }

        return toEpisodeSnapshotRequest(state.episode.data, target.episodeNumber, toMediaSnapshotRequest(series, 'tv'));
    }

    private patchRating(target: EpisodeTarget, patch: Partial<UserRatingState>): void {
        this.patchState((state) =>
            isSameEpisodeTarget(state.target, target)
                ? {
                      rating: {
                          ...state.rating,
                          ...patch,
                      },
                  }
                : {},
        );
    }

    private toEpisodeStillImages(stills: NonNullable<TvEpisodeImages['stills']>): ViewerImage[] {
        return stills.map((image) => ({
            ...image,
            photoType: 'still',
        }));
    }

    private toVideoItemsState(
        videosState: RemoteData<Video[]>,
        media: MediaDetails | null,
    ): RemoteData<VideoCardItem[]> {
        return mapRemoteData(videosState, (videos) => (media ? toVideoCardItems(videos, media) : []));
    }
}
