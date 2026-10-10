import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    combineLatest,
    distinctUntilChanged,
    filter,
    map,
    merge,
    shareReplay,
    switchMap,
    take,
    tap,
} from 'rxjs';

import {
    SeoMetadata,
    isDefined,
    mapRemoteData,
    parseBoundedIntegerParam,
    remoteData,
    toVideoCardItems,
    toYoutubeVideos,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameMediaTarget } from '../media-target';

@Injectable()
export class SeasonDetailPageStoreService extends ComponentStore<Record<string, never>> {
    readonly seasonDetail$ = this.select(
        this.mediaStore.currentTarget$,
        this.mediaStore.mediaDetails$,
        this.mediaSeasonsStore.season$,
        (target, media, season) => {
            const videos = mapRemoteData(season.videos, (videoList) =>
                media ? toVideoCardItems(toYoutubeVideos(videoList?.results ?? []), media) : [],
            );
            const videoCount = remoteData(videos, []).length;
            const episodeEntries = remoteData(season.episodes, []);
            const airDates = episodeEntries
                .map((entry) => entry.item.airDate)
                .filter((date): date is string => !!date)
                .sort();
            const totalRuntime = episodeEntries.reduce((sum, entry) => sum + (entry.item.runtime ?? 0), 0);

            return {
                backdropPath: media?.backdropPath ?? null,
                seriesTitle: media?.title ?? null,
                backLabel: media?.title ? `Back to ${media.title}` : 'Back',
                overviewLink: ['/title', target.id, target.type],
                summary: season.summary,
                hasSeasonOptions: season.seasonOptions.length > 0,
                seasonOptions: season.seasonOptions,
                selectedSeason: season.seasonNumber,
                firstAirDate: airDates[0] ?? null,
                lastAirDate: airDates.length > 1 ? airDates[airDates.length - 1] : null,
                totalRuntime: totalRuntime || null,
                episodes: season.episodes,
                videos,
                showVideos: videos.state !== 'success' || videoCount > 0,
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
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStore: MediaSeasonsStoreService,
        private readonly router: Router,
    ) {
        super({});
    }

    /** `seasonParam` is `null` on the `episodes` route, which opens the default season. */
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
        );
    }

    changeSeason$(seasonNumber: number): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(
            take(1),
            tap((target) => this.router.navigate(['/title', target.id, target.type, 'episodes', seasonNumber])),
        );
    }
}
