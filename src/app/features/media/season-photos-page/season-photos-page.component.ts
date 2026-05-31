import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, map, tap } from 'rxjs';

import {
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    SeoService,
    SubPageHeaderComponent,
} from '../../../shared';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';

@Component({
    selector: 'app-season-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    templateUrl: './season-photos-page.component.html',
    styleUrl: './season-photos-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonPhotosPageComponent {
    readonly pageTitle: string;
    readonly backLink: readonly string[];

    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        photosState: this.mediaSeasonsStoreService.seasonImagesState$,
    }).pipe(
        map(({ mediaState, photosState }) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;

            return {
                media,
                photosState,
                showSkeleton: mediaState.state === 'loading' || photosState.state === 'loading',
                subtitle: media?.title ? `${media.title}${media.year ? ` (${media.year})` : ''}` : null,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaSeasonsStoreService: MediaSeasonsStoreService,
        private readonly route: ActivatedRoute,
        private readonly dialog: MatDialog,
        private readonly seo: SeoService,
    ) {
        const seriesId = Number(this.route.parent!.snapshot.paramMap.get('id'));
        const mediaType = this.route.parent!.snapshot.paramMap.get('type') ?? 'tv';
        const seasonNumber = Number(this.route.snapshot.paramMap.get('seasonNumber'));

        this.pageTitle = `Season ${seasonNumber} Photos`;
        this.backLink = ['/title', String(seriesId), mediaType, 'episodes', String(seasonNumber)];
        this.mediaSeasonsStoreService.openSeason({ seriesId, seasonNumber });

        this.vm$
            .pipe(
                tap((vm) => {
                    if (vm.media) {
                        this.seo.setPage(
                            toMediaSectionSeoMetadata(vm.media, this.pageTitle),
                        );
                    }
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.dialog.open(PhotoViewerComponent, {
            data: { images: selection.images, activeIndex: selection.index },
            panelClass: 'photo-viewer-panel',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            autoFocus: false,
        });
    }
}
