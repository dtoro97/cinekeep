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
    SubPageHeaderComponent,
} from '../../../shared';
import { EpisodeDetailStoreService } from '../episode-detail-store.service';

@Component({
    selector: 'app-episode-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
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

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.photoViewerDialogService.open({ images: selection.images, activeIndex: selection.index });
    }
}
