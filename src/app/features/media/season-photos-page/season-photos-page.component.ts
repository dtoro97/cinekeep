import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { combineLatest, filter, map, tap } from 'rxjs';

import {
    PHOTO_VIEWER_DIALOG_CONFIG,
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    SeoService,
    SubPageHeaderComponent,
    formatTitleWithYear,
    parseBoundedIntegerParam,
} from '../../../shared';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaTarget } from '../media-target';
import { toMediaSectionSeoMetadata } from '../media-seo';

@Component({
    selector: 'app-season-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    templateUrl: './season-photos-page.component.html',
    styleUrl: './season-photos-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonPhotosPageComponent {
    readonly seasonNumber = input.required<string>();

    private readonly season$ = combineLatest([
        this.mediaStore.currentTarget$,
        toObservable(this.seasonNumber).pipe(map((value) => parseBoundedIntegerParam(value, 0, Number.MAX_SAFE_INTEGER))),
    ]).pipe(
        filter((season): season is [MediaTarget, number] => season[1] !== null),
        map(([target, seasonNumber]) => ({
            target,
            seasonNumber,
            pageTitle: `Season ${seasonNumber} Photos`,
            backLink: ['/title', target.id, target.type, 'episodes', seasonNumber],
        })),
    );

    readonly seasonPhotos$ = combineLatest({
        season: this.season$,
        mediaState: this.mediaStore.mediaDetailsState$,
        photosState: this.mediaSeasonsStoreService.seasonImagesState$,
    }).pipe(
        map(({ season, mediaState, photosState }) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;

            return {
                media,
                photosState,
                pageTitle: season.pageTitle,
                backLink: season.backLink,
                showSkeleton: mediaState.state === 'loading' || photosState.state === 'loading',
                subtitle: media?.title ? formatTitleWithYear(media.title, media.year) : null,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStoreService: MediaSeasonsStoreService,
        private readonly dialog: MatDialog,
        private readonly seo: SeoService,
    ) {
        this.season$
            .pipe(
                tap(({ target, seasonNumber }) =>
                    this.mediaSeasonsStoreService.openSeason({ seriesId: target.id, seasonNumber }),
                ),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.seasonPhotos$
            .pipe(
                tap((seasonPhotos) => {
                    if (seasonPhotos.media) {
                        this.seo.setPage(
                            toMediaSectionSeoMetadata(seasonPhotos.media, seasonPhotos.pageTitle),
                        );
                    }
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.dialog.open(PhotoViewerComponent, {
            ...PHOTO_VIEWER_DIALOG_CONFIG,
            data: { images: selection.images, activeIndex: selection.index },
        });
    }
}
