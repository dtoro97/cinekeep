import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import {
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    PHOTO_VIEWER_DIALOG_CONFIG,
    PhotoViewerComponent,
    SeoService,
    SubPageHeaderComponent,
} from '../../../shared';
import { PersonDetailStoreService } from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';

@Component({
    selector: 'app-person-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    templateUrl: './person-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPhotosPageComponent {
    readonly personDetail$ = this.store.personDetail$;

    constructor(
        private store: PersonDetailStoreService,
        private matDialog: MatDialog,
        seoService: SeoService,
    ) {
        this.store.seoSource$
            .pipe(takeUntilDestroyed())
            .subscribe(({ person, knownForTitles }) =>
                seoService.setPage(toPersonSeoMetadata(person, knownForTitles, 'photos')),
            );
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.matDialog.open(PhotoViewerComponent, {
            ...PHOTO_VIEWER_DIALOG_CONFIG,
            data: { images: selection.images, activeIndex: selection.index },
        });
    }
}
