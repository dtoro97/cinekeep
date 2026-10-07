import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { filter } from 'rxjs';

import {
    isDefined,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    PhotoViewerDialogService,
    SeoService,
    SubPageHeaderComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { MediaPhotosPageStoreService } from './media-photos-page-store.service';

@Component({
    selector: 'app-media-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    providers: [MediaPhotosPageStoreService],
    templateUrl: './media-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPhotosPageComponent {
    readonly mediaPhotos$ = this.store.mediaPhotos$;

    constructor(
        private readonly store: MediaPhotosPageStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Photos')));
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.photoViewerDialogService.open({ images: selection.images, activeIndex: selection.index });
    }
}
