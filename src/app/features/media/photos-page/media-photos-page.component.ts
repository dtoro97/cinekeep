import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    MediaType,
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    SeoService,
    SubPageHeaderComponent,
    PhotosBrowserSkeletonComponent,
    remoteData,
} from '../../../shared';
import { MediaImagesStoreService } from '../media-images-store.service';
import { MediaStoreService } from '../media-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

@Component({
    selector: 'app-media-photos-page',
    imports: [
        AsyncPipe,
        PhotosBrowserComponent,
        SubPageHeaderComponent,
        PhotosBrowserSkeletonComponent,
    ],
    templateUrl: './media-photos-page.component.html',
    styleUrl: './media-photos-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPhotosPageComponent {
    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        photosState: this.mediaImagesStoreService.imagesState$,
    }).pipe(
        map(({ mediaState, photosState }) => ({
            media: mediaState.state === 'success' ? mediaState.data : null,
            photosState,
            images: remoteData(photosState, []),
        })),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaImagesStoreService: MediaImagesStoreService,
        private readonly dialog: MatDialog,
        private readonly seo: SeoService,
        private readonly route: ActivatedRoute,
    ) {
        this.route.parent!.paramMap
            .pipe(
                map((params) => ({
                    id: Number(params.get('id')),
                    type: (params.get('type') ?? 'movie') as MediaType,
                })),
                filter(({ id }) => Number.isInteger(id)),
                switchMap((target) => this.mediaImagesStoreService.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaStore.mediaDetailsState$
            .pipe(
                map((state) => (state.state === 'success' ? state.data : null)),
                filter((media): media is MediaDetails => !!media),
                tap((media) =>
                    this.seo.setPage(toMediaSectionSeoMetadata(media, 'Photos')),
                ),
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
