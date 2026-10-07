import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, combineLatest, filter, switchMap } from 'rxjs';

import { SeoMetadata, formatTitleWithYear, isDefined, parseBoundedIntegerParam } from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';

interface SeasonPhotosPageState {
    /** `null` when the route's season number is invalid. */
    readonly seasonNumber: number | null;
}

const INITIAL_STATE: SeasonPhotosPageState = {
    seasonNumber: null,
};

@Injectable()
export class SeasonPhotosPageStoreService extends ComponentStore<SeasonPhotosPageState> {
    readonly seasonPhotos$ = this.select(
        this.state$,
        this.mediaStore.currentTarget$,
        this.mediaStore.mediaDetails$,
        this.mediaSeasonsStore.season$,
        ({ seasonNumber }, target, media, { images }) => {
            // An invalid season number in the URL opens no season, so the store's images belong to another one.
            const hasSeason = seasonNumber !== null;

            return {
                backdropPath: media?.backdropPath ?? null,
                isMediaLoading: !media,
                pageTitle: hasSeason ? `Season ${seasonNumber} Photos` : 'Season Photos',
                subtitle: media?.title ? formatTitleWithYear(media.title, media.year) : null,
                backLink: ['/title', target.id, target.type, 'episodes', seasonNumber ?? ''],
                showSkeleton: hasSeason && (!media || images.state === 'loading'),
                images: hasSeason && images.state === 'success' ? images.data : null,
            };
        },
        { debounce: true },
    );

    readonly seoMetadata$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ seasonNumber }, media): SeoMetadata | null =>
            media && seasonNumber !== null ? toMediaSectionSeoMetadata(media, `Season ${seasonNumber} Photos`) : null,
        { debounce: true },
    ).pipe(filter(isDefined));

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStore: MediaSeasonsStoreService,
    ) {
        super(INITIAL_STATE);
    }

    load$(seasonParam$: Observable<string | null>): Observable<unknown> {
        return combineLatest([this.mediaStore.currentTarget$, seasonParam$]).pipe(
            switchMap(([target, param]) => {
                const seasonNumber = parseBoundedIntegerParam(param, 0, Number.MAX_SAFE_INTEGER);
                this.patchState({ seasonNumber });

                return seasonNumber === null
                    ? EMPTY
                    : this.mediaSeasonsStore.openSeason$({ seriesId: target.id, seasonNumber });
            }),
        );
    }
}
