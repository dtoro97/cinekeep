import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import {
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    PhotoViewerDialogService,
    SeoService,
} from '../../../shared';
import { EpisodeDetailStoreService } from '../episode-detail-store.service';
import { MediaSubPageHeaderComponent } from '../media-sub-page-header/media-sub-page-header.component';

@Component({
    selector: 'app-episode-photos-page',
    imports: [AsyncPipe, MediaSubPageHeaderComponent, PhotosBrowserComponent, PhotosBrowserSkeletonComponent],
    templateUrl: './episode-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodePhotosPageComponent {
    readonly episodePhotos$ = this.store.episodePhotos$;

    constructor(
        private readonly store: EpisodeDetailStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store.loadPhotos$(activatedRoute.paramMap).pipe(takeUntilDestroyed()).subscribe();

        this.store.episodePhotosSeo$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(selection: PhotosBrowserSelection, title: string): void {
        this.photoViewerDialogService.open({ images: selection.images, activeIndex: selection.index, title });
    }
}
