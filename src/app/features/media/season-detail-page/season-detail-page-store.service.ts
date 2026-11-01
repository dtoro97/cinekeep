import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, combineLatest, distinctUntilChanged, filter, map, merge, shareReplay, switchMap, tap } from 'rxjs';

import {
    SeoMetadata,
    UserSessionStoreService,
    isDefined,
    mapRemoteData,
    parseBoundedIntegerParam,
    remoteData,
    toVideoCardItems,
    toYoutubeVideos,
} from '../../../shared';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameMediaTarget } from '../media-target';

// One row of the six-up poster wall.
const POSTER_PREVIEW_COUNT = 6;
const SIDEBAR_VIDEO_COUNT = 5;

@Injectable()
export class SeasonDetailPageStoreService extends ComponentStore<Record<string, never>> {
    readonly seasonDetail$ = this.select(
        this.mediaDetailStore.watchProviders$,
        this.mediaStore.currentTarget$,
        this.mediaStore.mediaDetails$,
        this.mediaSeasonsStore.season$,
        this.userSessionStore.authSession$,
        (providers, target, media, season, { isAuthenticated }) => {
            const imageList = remoteData(season.images, []);
            const videos = mapRemoteData(season.videos, (videoList) =>
                media ? toVideoCardItems(toYoutubeVideos(videoList?.results ?? []), media) : [],
            );
            const episodes = remoteData(season.episodes, []);
            const airDates = episodes
                .map((entry) => entry.item.airDate)
                .filter(isDefined)
                .sort();

            return {
                backdropPath: media?.backdropPath ?? null,
                mediaTitle: media?.title ?? null,
                overviewLink: ['/title', target.id, target.type],
                summary: season.summary,
                year: season.summary?.airDate?.slice(0, 4) ?? null,
                airedFrom: airDates[0] ?? null,
                airedTo: airDates.length > 1 ? (airDates.at(-1) ?? null) : null,
                seasonTabs: season.seasonOptions.map((option) => ({
                    label: option.label,
                    seasonNumber: option.value,
                    routeCommands: ['/title', target.id, target.type, 'episodes', option.value],
                    isActive: option.value === season.seasonNumber,
                })),
                episodes: season.episodes,
                imageList,
                imageCount: imageList.length,
                showPosterSkeleton: season.images.state === 'loading',
                posterPreview: imageList.slice(0, POSTER_PREVIEW_COUNT),
                posterSkeletonCount: POSTER_PREVIEW_COUNT,
                photosLink:
                    season.seasonNumber !== null && imageList.length > 0
                        ? ['/title', target.id, target.type, 'episodes', season.seasonNumber, 'photos']
                        : null,
                videos: remoteData(videos, []).slice(0, SIDEBAR_VIDEO_COUNT),
                providers,
                isAuthenticated,
            };
        },
        { debounce: true },
    );

    readonly seoMetadata$ = this.select(
        this.mediaStore.mediaDetails$,
        this.mediaSeasonsStore.season$,
        (media, { seasonNumber }): SeoMetadata | null =>
            media
                ? toMediaSectionSeoMetadata(
                      media,
                      seasonNumber === null ? 'Episodes' : `Season ${seasonNumber} Episodes`,
                  )
                : null,
        { debounce: true },
    ).pipe(filter(isDefined));

    constructor(
        private readonly mediaDetailStore: MediaDetailStoreService,
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStore: MediaSeasonsStoreService,
        private readonly router: Router,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super({});
    }

    // `seasonParam` is `null` on the `episodes` route, which opens the default season.
    load$(seasonParam$: Observable<string | null>): Observable<unknown> {
        const route$ = combineLatest([this.mediaStore.currentTarget$, seasonParam$]).pipe(
            distinctUntilChanged(
                ([previousTarget, previousParam], [target, param]) =>
                    isSameMediaTarget(previousTarget, target) && previousParam === param,
            ),
            map(([target, param]) => {
                const seasonNumber = parseBoundedIntegerParam(param, 0, Number.MAX_SAFE_INTEGER);
                return { target, seasonNumber, isParamValid: param === null || seasonNumber !== null };
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
        );

        return merge(
            route$.pipe(
                switchMap(({ target, isParamValid, seasonNumber }) => {
                    if (!isParamValid) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                        return EMPTY;
                    }

                    return seasonNumber === null
                        ? this.mediaSeasonsStore.openSeries$(target.id)
                        : this.mediaSeasonsStore.openSeason$({ seriesId: target.id, seasonNumber });
                }),
            ),
            combineLatest([route$, this.mediaStore.mediaState$]).pipe(
                tap(([{ seasonNumber }, media]) => {
                    if (media.state !== 'success') {
                        return;
                    }

                    // Movies have no seasons, and a season number must exist in the series.
                    const isMissing =
                        !media.data ||
                        !('seasons' in media.data) ||
                        (seasonNumber !== null &&
                            !(media.data.seasons ?? []).some((season) => season.season_number === seasonNumber));

                    if (isMissing) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
            ),
            this.mediaStore.currentTarget$.pipe(
                distinctUntilChanged(isSameMediaTarget),
                switchMap((target) => this.mediaDetailStore.loadWatchProviders$(target)),
            ),
        );
    }
}
