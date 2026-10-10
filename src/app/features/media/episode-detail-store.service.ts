import { Injectable } from '@angular/core';
import { ParamMap, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    combineLatest,
    distinctUntilChanged,
    filter,
    forkJoin,
    map,
    of,
    switchMap,
    tap,
} from 'rxjs';

import { TvEpisode, TvEpisodeCredits, TvEpisodeImages, TvEpisodeRestControllerService, VideoList } from '../../api';
import { EpisodeRatingControllerService } from '../../api-cinekeep';
import {
    EpisodeSnapshotRequest,
    IMAGE_LANGUAGE_FALLBACK,
    LocaleStoreService,
    MediaRatingService,
    RemoteData,
    SeoMetadata,
    UserSessionStoreService,
    ViewerImage,
    formatEpisodeCode,
    formatTitleWithYear,
    getISODate,
    isDefined,
    mapRemoteData,
    normalizeRatingValue,
    pluralize,
    remoteData,
    remoteSuccess,
    RouteCommands,
    toEpisodeSnapshotRequest,
    toMediaSnapshotRequest,
    toRating,
    toSeoImage,
    toVideoCardItems,
    toCastPersonCardItem,
    toYoutubeVideos,
} from '../../shared';
import { toGuestCast } from './episode-credits.mapper';
import { toKeyCredits } from './key-credits.mapper';
import type { CastGridMember, MediaCreditsResource } from './media-credits-store.service';
import { CreditsSummary, toCreditsSummary } from './media-credits-summary/media-credits-summary.model';
import { MediaSeasonsStoreService, toSeasonLabel } from './media-seasons-store.service';
import { MediaStoreService } from './media-store.service';
import { EpisodeTarget, isSameEpisodeTarget, toEpisodeTarget } from './media-target';
import { UserRatingState, toUserRatingDisplay, writeUserRating$ } from './user-rating-state';

export interface EpisodeRatingRequest {
    readonly target: EpisodeTarget;
    readonly title: string;
    readonly currentRating: number | null;
}

interface EpisodeDetailState {
    readonly target: EpisodeTarget | null;
    readonly episode: RemoteData<TvEpisode | null>;
    readonly episodeImages: RemoteData<TvEpisodeImages | null>;
    /** The episode's own cast (regulars who appear in it), guest stars and crew. */
    readonly episodeCredits: RemoteData<TvEpisodeCredits | null>;
    readonly episodeVideos: RemoteData<VideoList | null>;
    /** The season's episodes, for the previous/next episode names. */
    readonly seasonEpisodes: RemoteData<TvEpisode[]>;
    readonly rating: UserRatingState;
}

const STILL_PREVIEW_COUNT = 6;
const CAST_PREVIEW_COUNT = 6;

const INITIAL_STATE: EpisodeDetailState = {
    target: null,
    episode: { state: 'notAsked' },
    episodeImages: { state: 'notAsked' },
    episodeCredits: { state: 'notAsked' },
    episodeVideos: { state: 'notAsked' },
    seasonEpisodes: { state: 'notAsked' },
    rating: { userRating: { state: 'notAsked' }, ratingPending: false },
};

/** Shared by the episode page and its photos page, so moving between them keeps the loaded episode. */
@Injectable()
export class EpisodeDetailStoreService extends ComponentStore<EpisodeDetailState> {
    readonly episodeDetail$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        (
            { target, episode: episodeState, episodeImages, episodeCredits, episodeVideos, seasonEpisodes, rating },
            media,
        ) => {
            const episode = episodeState.state === 'success' ? episodeState.data : null;
            const isLoading = episodeState.state === 'loading';
            const guestStars = episode?.guest_stars ?? [];
            const stills = toStills(episodeImages);
            const stillList = remoteData(stills, []);
            const videos = mapRemoteData(
                episodeVideos.state === 'notAsked' ? { state: 'loading' } : episodeVideos,
                (videoList) => (media ? toVideoCardItems(toYoutubeVideos(videoList?.results ?? []), media) : []),
            );
            const videoCount = remoteData(videos, []).length;
            const airDate = episode?.air_date;
            const canRateEpisode = airDate ? airDate <= getISODate(0) : false;
            const tmdbRating = toRating(episode?.vote_average);
            const userRating = toUserRatingDisplay(rating, target !== null);
            const crewRows = toKeyCredits('episode', episode?.crew ?? []);
            const ratingRequest: EpisodeRatingRequest | null =
                target && !userRating.disabled
                    ? { target, title: episode?.name ?? 'this episode', currentRating: userRating.currentRating }
                    : null;
            const guestCast: RemoteData<CreditsSummary> = isLoading
                ? { state: 'loading' }
                : remoteSuccess(toGuestCast(guestStars));
            const episodeCast: RemoteData<CreditsSummary> =
                episodeCredits.state === 'notAsked'
                    ? { state: 'loading' }
                    : mapRemoteData(episodeCredits, (credits) =>
                          toCreditsSummary(
                              (credits?.cast ?? [])
                                  .filter(({ id }) => !!id)
                                  .slice(0, CAST_PREVIEW_COUNT)
                                  .map(toCastPersonCardItem),
                              [],
                          ),
                      );
            const seasonList = seasonEpisodes.state === 'success' ? seasonEpisodes.data : [];
            const seasonStrip = target
                ? seasonList.map((item) => ({
                      key: item.id ?? item.episode_number ?? 0,
                      label: `${item.episode_number ?? ''}. ${item.name ?? 'Untitled episode'}`,
                      stillPath: item.still_path ?? null,
                      isCurrent: item.episode_number === target.episodeNumber,
                      ariaCurrent: item.episode_number === target.episodeNumber ? 'page' : null,
                      link: [
                          '/title',
                          target.seriesId,
                          'tv',
                          'episodes',
                          target.seasonNumber,
                          item.episode_number ?? 0,
                      ],
                  }))
                : [];

            return {
                episode,
                hasMeta: !!(episode?.air_date || episode?.runtime),
                isOverviewEmpty: !episode?.overview,
                overviewText: episode?.overview || 'No overview available.',
                tmdbRating,
                canRateEpisode,
                userRating,
                ratingRequest,
                heroImage: episode?.still_path ?? media?.backdropPath ?? null,
                hasCrewRows: crewRows.length > 0,
                crewRows,
                guestCast,
                hasGuestCast: isLoading || guestStars.length > 0,
                videos,
                showVideos: videos.state !== 'success' || videoCount > 0,
                stillPreview: stillList.slice(0, STILL_PREVIEW_COUNT).map((image, index) => ({
                    image,
                    index,
                    label: `Open still ${index + 1} of ${stillList.length}`,
                })),
                stillsLink: target
                    ? ['/title', target.seriesId, 'tv', 'episodes', target.seasonNumber, target.episodeNumber, 'photos']
                    : null,
                allStillsLabel: `All ${stillList.length} stills`,
                // The preview already shows every still when there are only a few.
                hasMoreStills: stillList.length > STILL_PREVIEW_COUNT,
                showStillsSkeleton: stills.state === 'loading',
                episodeCast,
                showEpisodeCast: episodeCast.state !== 'success' || !!episodeCast.data?.hasTopCast,
                castLink: target ? [...toEpisodeLink(target), 'cast'] : null,
                seasonStrip,
                hasSeasonStrip: seasonStrip.length > 1,
                viewerTitle: [media?.title, episode?.name].filter(Boolean).join(' · '),
                eyebrowLabel: [media?.title, target ? `Episode ${target.episodeNumber}` : null]
                    .filter(Boolean)
                    .join(' · '),
                backLabel: target ? `Back to ${toSeasonLabel(target.seasonNumber)}` : 'Back',
                stillList,
                showStills: stills.state !== 'success' || stillList.length > 0,
                episodesLink: target ? ['/title', target.seriesId, 'tv', 'episodes', target.seasonNumber] : null,
                seasonLabel: target ? toSeasonLabel(target.seasonNumber) : '',
            };
        },
    );

    readonly episodeSeo$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ episode }, media): SeoMetadata | null => {
            if (!media || episode.state !== 'success' || !episode.data) {
                return null;
            }

            const { name, overview, season_number, episode_number, still_path } = episode.data;
            const episodeCode = formatEpisodeCode(season_number ?? 0, episode_number ?? 0);
            const episodeLabel = name ? `${name} (${episodeCode})` : episodeCode;
            const mediaTitle = formatTitleWithYear(media.title, media.year);

            return {
                title: `${mediaTitle} | ${episodeLabel}`,
                description:
                    overview || `Episode details, cast, videos, and photos for ${episodeLabel} from ${mediaTitle}.`,
                ...toSeoImage(still_path ?? media.backdropPath, media.posterPath),
                imageAlt: `${name || episodeCode} episode still`,
                type: 'video.tv_show',
            };
        },
    ).pipe(filter(isDefined));

    readonly episodePhotos$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ target, episode: episodeState, episodeImages }, media) => {
            const episode = episodeState.state === 'success' ? episodeState.data : null;
            const stills = toStills(episodeImages);
            const stillCount = remoteData(stills, []).length;
            return {
                media,
                ...toEpisodeSubPageHeader(
                    target,
                    episode,
                    media?.title,
                    stills.state === 'success' ? pluralize(stillCount, 'still') : null,
                ),
                viewerTitle: [media?.title, episode?.name].filter(Boolean).join(' · '),
                showSkeleton: stills.state === 'loading',
                stills: stills.state === 'success' ? stills.data : null,
            };
        },
    );

    /** The episode's credits in the shape the cast page reads: regulars first, then guest stars. */
    readonly episodeCast$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ target, episode: episodeState, episodeCredits }, media) => ({
            header: toEpisodeSubPageHeader(
                target,
                episodeState.state === 'success' ? episodeState.data : null,
                media?.title,
                null,
            ),
            credits: mapRemoteData(episodeCredits, (credits): MediaCreditsResource => ({
                cast: [
                    ...(credits?.cast ?? []),
                    ...(credits?.guest_stars ?? []).map((guest): CastGridMember => ({ ...guest })),
                ],
                crew: credits?.crew ?? [],
            })),
        }),
    );

    readonly episodePhotosSeo$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ target, episode }, media): SeoMetadata | null => {
            if (!media || !target) {
                return null;
            }

            const loadedEpisode = episode.state === 'success' ? episode.data : null;
            const episodeName = loadedEpisode?.name || formatEpisodeCode(target.seasonNumber, target.episodeNumber);
            const mediaTitle = formatTitleWithYear(media.title, media.year);

            return {
                title: `${mediaTitle} | ${episodeName} Photos`,
                description: `Photos from ${episodeName} of ${mediaTitle}.`,
                ...toSeoImage(loadedEpisode?.still_path ?? media.backdropPath, media.posterPath),
                imageAlt: `${episodeName} Photos preview`,
                type: 'video.tv_show',
            };
        },
    ).pipe(filter(isDefined));

    constructor(
        private readonly episodeRatingControllerService: EpisodeRatingControllerService,
        private readonly localeStore: LocaleStoreService,
        private readonly mediaRatingService: MediaRatingService,
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStore: MediaSeasonsStoreService,
        private readonly router: Router,
        private readonly tvEpisodeService: TvEpisodeRestControllerService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super(INITIAL_STATE);
    }

    /** Loads the episode named by the route, redirecting to not-found when there is none. */
    load$(paramMap$: Observable<ParamMap>): Observable<unknown> {
        return this.toEpisodeTarget$(paramMap$, true).pipe(
            switchMap((target) => {
                const { target: previous, seasonEpisodes } = this.get();

                this.setState({
                    ...INITIAL_STATE,
                    target,
                    episode: { state: 'loading' },
                    episodeImages: { state: 'loading' },
                    episodeCredits: { state: 'loading' },
                    episodeVideos: { state: 'loading' },
                    // Moving to another episode of the same season keeps the loaded season list.
                    seasonEpisodes:
                        previous?.seriesId === target.seriesId && previous.seasonNumber === target.seasonNumber
                            ? seasonEpisodes
                            : { state: 'loading' },
                    rating: { userRating: { state: 'loading' }, ratingPending: false },
                });
                this.loadEpisodeRating(target);
                this.loadSeasonEpisodes(target);

                return forkJoin({
                    episode: this.fetchEpisode$(target),
                    images: this.fetchEpisodeImages$(target),
                    credits: this.fetchEpisodeCredits$(target),
                    videos: this.tvEpisodeService
                        .tvEpisodeVideos(target)
                        // Videos are optional, so a failure shows the episode without them.
                        .pipe(catchError(() => of({ results: [] }))),
                }).pipe(
                    tap(({ episode, images, credits, videos }) => {
                        this.patchState({
                            episode: remoteSuccess(episode),
                            episodeImages: remoteSuccess(images),
                            episodeCredits: remoteSuccess(credits),
                            episodeVideos: remoteSuccess(videos),
                        });

                        if (!episode) {
                            this.router.navigate(['/not-found'], { replaceUrl: true });
                        }
                    }),
                );
            }),
        );
    }

    /** Loads the episode and its stills for the photos page, reusing what the episode page loaded. */
    loadPhotos$(paramMap$: Observable<ParamMap>): Observable<unknown> {
        return this.toEpisodeTarget$(paramMap$, false).pipe(
            switchMap((target) => {
                const state = this.get();

                if (
                    isSameEpisodeTarget(state.target, target) &&
                    state.episode.state === 'success' &&
                    state.episodeImages.state === 'success'
                ) {
                    return EMPTY;
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
                    tap(({ episode, images }) =>
                        this.patchState({ episode: remoteSuccess(episode), episodeImages: remoteSuccess(images) }),
                    ),
                );
            }),
        );
    }

    /** Loads the episode and its credits for the episode cast page, reusing what the episode page loaded. */
    loadCast$(paramMap$: Observable<ParamMap>): Observable<unknown> {
        return this.toEpisodeTarget$(paramMap$, true).pipe(
            switchMap((target) => {
                const state = this.get();

                if (
                    isSameEpisodeTarget(state.target, target) &&
                    state.episode.state === 'success' &&
                    state.episodeCredits.state === 'success'
                ) {
                    return EMPTY;
                }

                this.setState({
                    ...INITIAL_STATE,
                    target,
                    episode: { state: 'loading' },
                    episodeCredits: { state: 'loading' },
                });

                return forkJoin({
                    episode: this.fetchEpisode$(target),
                    credits: this.fetchEpisodeCredits$(target),
                }).pipe(
                    tap(({ episode, credits }) =>
                        this.patchState({ episode: remoteSuccess(episode), episodeCredits: remoteSuccess(credits) }),
                    ),
                );
            }),
        );
    }

    submitUserRating$(target: EpisodeTarget, value: number): Observable<unknown> {
        const { target: current, episode } = this.get();
        const series = this.mediaStore.currentMediaFor({ id: target.seriesId, type: 'tv' });
        const snapshot: EpisodeSnapshotRequest | undefined =
            isSameEpisodeTarget(current, target) && episode.state === 'success' && episode.data && series
                ? toEpisodeSnapshotRequest(episode.data, target.episodeNumber, toMediaSnapshotRequest(series, 'tv'))
                : undefined;

        return writeUserRating$(
            this.mediaRatingService.rateEpisode$(
                target.seriesId,
                target.seasonNumber,
                target.episodeNumber,
                value,
                snapshot,
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

    /** Follows sign-in changes, so the rating appears or clears without a reload. */
    private readonly loadEpisodeRating = this.effect<EpisodeTarget>((target$) =>
        target$.pipe(
            switchMap((target) =>
                this.userSessionStore.settledIsAuthenticated$.pipe(
                    switchMap((isAuthenticated) =>
                        (isAuthenticated
                            ? this.mediaRatingService.getEpisodeRating$(
                                  target.seriesId,
                                  target.seasonNumber,
                                  target.episodeNumber,
                              )
                            : of(null)
                        ).pipe(
                            // An unknown rating shows as unrated.
                            catchError(() => of(null)),
                        ),
                    ),
                    tap((userRating) =>
                        this.patchRating(target, { userRating: remoteSuccess(userRating), ratingPending: false }),
                    ),
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
                    // Without the season list the pager falls back to the series' episode counts.
                    catchError(() => of([])),
                    tap((episodes) => this.patchState({ seasonEpisodes: remoteSuccess(episodes) })),
                ),
            ),
        ),
    );

    private toEpisodeTarget$(paramMap$: Observable<ParamMap>, redirectInvalid: boolean): Observable<EpisodeTarget> {
        return combineLatest([this.mediaStore.currentTarget$, paramMap$]).pipe(
            map(([media, paramMap]) =>
                toEpisodeTarget(media.id, paramMap.get('seasonNumber'), paramMap.get('episodeNumber')),
            ),
            tap((target) => {
                if (!target && redirectInvalid) {
                    this.router.navigate(['/not-found'], { replaceUrl: true });
                }
            }),
            filter(isDefined),
            distinctUntilChanged(isSameEpisodeTarget),
        );
    }

    private fetchEpisode$(target: EpisodeTarget): Observable<TvEpisode | null> {
        return (
            this.tvEpisodeService
                .tvEpisodeDetails(target)
                // A missing episode is handled by the page as not found.
                .pipe(catchError(() => of(null)))
        );
    }

    private fetchEpisodeCredits$(target: EpisodeTarget): Observable<TvEpisodeCredits | null> {
        return (
            this.tvEpisodeService
                .tvEpisodeCredits(target)
                // Credits are optional, so a failure shows the episode without its cast.
                .pipe(catchError(() => of(null)))
        );
    }

    private fetchEpisodeImages$(target: EpisodeTarget): Observable<TvEpisodeImages | null> {
        return (
            this.tvEpisodeService
                .tvEpisodeImages({
                    ...target,
                    includeImageLanguage: IMAGE_LANGUAGE_FALLBACK,
                    language: this.localeStore.language(),
                })
                // Stills are optional, so a failure shows the episode without them.
                .pipe(catchError(() => of(null)))
        );
    }

    private patchRating(target: EpisodeTarget, patch: Partial<UserRatingState>): void {
        this.patchState((state) =>
            isSameEpisodeTarget(state.target, target) ? { rating: { ...state.rating, ...patch } } : {},
        );
    }
}

/** Stills not requested yet show as loading, because opening the episode requests them. */
const toStills = (images: RemoteData<TvEpisodeImages | null>): RemoteData<ViewerImage[]> =>
    images.state === 'notAsked'
        ? { state: 'loading' }
        : mapRemoteData(images, (data) =>
              (data?.stills ?? []).map((image): ViewerImage => ({ ...image, photoType: 'still' })),
          );

const toEpisodeLink = (target: EpisodeTarget): RouteCommands => [
    '/title',
    target.seriesId,
    'tv',
    'episodes',
    target.seasonNumber,
    target.episodeNumber,
];

/** The header of an episode's own subpages (stills, cast): back to the episode, its still and where it sits. */
const toEpisodeSubPageHeader = (
    target: EpisodeTarget | null,
    episode: TvEpisode | null,
    seriesTitle: string | undefined,
    countLabel: string | null,
) => ({
    episodeLink: target ? toEpisodeLink(target) : null,
    backLabel: episode?.name ? `Back to ${episode.name}` : 'Back to episode',
    stillPath: episode?.still_path ?? null,
    metaText: target
        ? [seriesTitle, toSeasonLabel(target.seasonNumber), `Episode ${target.episodeNumber}`, countLabel]
              .filter(Boolean)
              .join(' · ')
        : null,
});
