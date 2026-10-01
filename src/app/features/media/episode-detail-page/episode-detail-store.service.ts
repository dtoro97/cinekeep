import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import {
    Observable,
    catchError,
    combineLatest,
    forkJoin,
    map,
    of,
    switchMap,
    tap,
} from 'rxjs';

import {
    CastMember,
    CrewMember,
    TvEpisode,
    TvEpisodeImages,
    TvEpisodeRestControllerService,
    Video,
    VideoList,
} from '../../../api';
import {
    LocaleStoreService,
    MediaRatingService,
    EpisodeSnapshotRequest,
    RemoteData,
    UserRatingState,
    UserRatingVm,
    UserSessionStoreService,
    VideoCardItem,
    ViewerImage,
    buildImageLanguageFallback,
    getISODate,
    isDefined,
    mapRemoteData,
    normalizeRatingValue,
    remoteData,
    toVideoCardItems,
    toYoutubeVideos,
    toEpisodeSnapshotRequest,
    toMediaSnapshotRequest,
    toUserRatingVm,
    writeUserRating$,
} from '../../../shared';
import { groupCrewMembers } from '../mappers/cast-crew.mapper';
import { EpisodeTarget, isSameEpisodeTarget } from '../media-target';
import { MediaStoreService } from '../media-store.service';
import { GroupedCrew } from '../models/cast-crew.model';
import { MediaDetails } from '../models/media-details.model';

interface EpisodeDetailState {
    readonly target: EpisodeTarget | null;
    readonly episode: RemoteData<TvEpisode | null>;
    readonly episodeImages: RemoteData<TvEpisodeImages | null>;
    readonly episodeVideos: RemoteData<VideoList | null>;
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
    rating: EMPTY_RATING_RESOURCE,
};

export interface EpisodeDetailVm {
    media: MediaDetails | null;
    episode: TvEpisode | null;
    isLoading: boolean;
    canRateEpisode: boolean;
    userRating: UserRatingVm;
    headerCrew: {
        readonly director: CrewMember | null;
        readonly writer: CrewMember | null;
        readonly hasCrew: boolean;
    };
    groupedCrew: GroupedCrew[];
    guestStars: CastMember[];
    videosState: RemoteData<VideoCardItem[]>;
    videoCount: number;
    stillsState: RemoteData<ViewerImage[]>;
    stillsTotalCount: number;
}

@Injectable()
export class EpisodeDetailStoreService extends ComponentStore<EpisodeDetailState> {
    private readonly target$ = this.select((state) => state.target);
    private readonly mediaState$ = this.mediaStore.mediaDetailsState$;
    private readonly episodeImagesState$ = this.select((state) => state.episodeImages);
    private readonly episodeVideosState$ = this.select((state) => state.episodeVideos);
    private readonly activeRating$ = this.select((state) => state.rating);

    readonly episodeState$ = this.select((state) => state.episode);

    readonly userRatingVm$ = this.select(this.activeRating$, this.target$, (rating, target) =>
        toUserRatingVm(rating, target !== null),
    );

    readonly allStillsState$ = this.episodeImagesState$.pipe(
        map((images): RemoteData<ViewerImage[]> =>
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
        map((videos): RemoteData<Video[]> =>
            videos.state === 'notAsked'
                ? { state: 'loading' }
                : mapRemoteData(videos, (data) => toYoutubeVideos(data?.results ?? [])),
        ),
    );

    readonly vm$ = combineLatest([
        this.mediaState$,
        this.episodeState$,
        this.stillsState$,
        this.youtubeVideosState$,
        this.allStills$,
        this.userRatingVm$,
    ]).pipe(
        map(
            ([
                mediaState,
                episodeState,
                stillsState,
                videosState,
                allStills,
                userRating,
            ]): EpisodeDetailVm => {
                const media = mediaState.state === 'success' ? mediaState.data : null;
                const episode = episodeState.state === 'success' ? episodeState.data : null;
                const isLoading = episodeState.state === 'loading';
                const director = episode?.crew?.find((crewMember) => crewMember.job === 'Director') ?? null;
                const writer =
                    episode?.crew?.find(
                        (crewMember) => crewMember.job === 'Writer' || crewMember.job === 'Screenplay',
                    ) ?? null;
                const groupedCrew = groupCrewMembers(episode?.crew ?? []);
                const guestStars = episode?.guest_stars ?? [];
                const stillsTotalCount = allStills.length;
                const videoItemsState = this.toVideoItemsState(videosState, media);
                const youtubeVideoCount = videoItemsState.state === 'success' ? videoItemsState.data.length : 0;
                const airDate = episode?.air_date;

                return {
                    media,
                    episode,
                    isLoading,
                    canRateEpisode: airDate ? airDate <= getISODate(0) : false,
                    userRating,
                    headerCrew: {
                        director,
                        writer,
                        hasCrew: isDefined(director) || isDefined(writer),
                    },
                    groupedCrew,
                    guestStars,
                    videosState: videoItemsState,
                    videoCount: youtubeVideoCount,
                    stillsState,
                    stillsTotalCount,
                };
            },
        ),
    );

    constructor(
        private readonly localeStore: LocaleStoreService,
        private readonly mediaRatingService: MediaRatingService,
        private readonly mediaStore: MediaStoreService,
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
                    rating: loadingRatingResource(),
                });
                this.fetchEpisodeRatingEffect(target);
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
            this.mediaRatingService.deleteEpisodeRating$(target.seriesId, target.seasonNumber, target.episodeNumber),
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

    private fetchEpisode$(target: EpisodeTarget): Observable<TvEpisode | null> {
        return this.tvEpisodeService.tvEpisodeDetails({
            seriesId: target.seriesId,
            seasonNumber: target.seasonNumber,
            episodeNumber: target.episodeNumber,
        }).pipe(
            catchError(() => of(null)),
        );
    }

    private fetchEpisodeImages$(target: EpisodeTarget): Observable<TvEpisodeImages | null> {
        return this.tvEpisodeService
            .tvEpisodeImages({
                seriesId: target.seriesId,
                seasonNumber: target.seasonNumber,
                episodeNumber: target.episodeNumber,
                includeImageLanguage: buildImageLanguageFallback(),
                language: this.localeStore.language(),
            })
            .pipe(
                catchError(() => of(null)),
            );
    }

    private fetchEpisodeVideos$(target: EpisodeTarget): Observable<VideoList | null> {
        return this.tvEpisodeService.tvEpisodeVideos({
            seriesId: target.seriesId,
            seasonNumber: target.seasonNumber,
            episodeNumber: target.episodeNumber,
        }).pipe(
            catchError(() => of({ results: [] })),
        );
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

        if (!isSameEpisodeTarget(state.target, target) || state.episode.state !== 'success' || !state.episode.data || !series) {
            return undefined;
        }

        return toEpisodeSnapshotRequest(
            state.episode.data,
            target.episodeNumber,
            toMediaSnapshotRequest(series, 'tv'),
        );
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

    private toVideoItemsState(videosState: RemoteData<Video[]>, media: MediaDetails | null): RemoteData<VideoCardItem[]> {
        return mapRemoteData(videosState, (videos) => (media ? toVideoCardItems(videos, media) : []));
    }
}
