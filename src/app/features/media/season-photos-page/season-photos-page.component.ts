import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { map } from 'rxjs';

import {
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    PhotoViewerDialogService,
    SeoService,
    SubPageHeaderComponent,
} from '../../../shared';
import { SeasonPhotosPageStoreService } from './season-photos-page-store.service';

@Component({
    selector: 'app-season-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    providers: [SeasonPhotosPageStoreService],
    templateUrl: './season-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonPhotosPageComponent {
    readonly seasonPhotos$ = this.store.seasonPhotos$;

    constructor(
        private readonly store: SeasonPhotosPageStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store
            .load$(activatedRoute.paramMap.pipe(map((paramMap) => paramMap.get('seasonNumber'))))
            .pipe(takeUntilDestroyed())
            .subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.photoViewerDialogService.open({ images: selection.images, activeIndex: selection.index });
    }
}
