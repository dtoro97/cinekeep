import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { tap } from 'rxjs';

import {
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    SubPageHeaderComponent,
    PhotosBrowserSkeletonComponent,
    SeoService,
} from '../../../shared';
import { PersonDetailStoreService } from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';

@Component({
    selector: 'app-person-photos-page',
    imports: [
        AsyncPipe,
        PhotosBrowserComponent,
        SubPageHeaderComponent,
        PhotosBrowserSkeletonComponent,
    ],
    templateUrl: './person-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPhotosPageComponent {
    constructor(
        public personDetailStore: PersonDetailStoreService,
        private dialog: MatDialog,
        private readonly seo: SeoService,
    ) {
        this.personDetailStore.seoSource$
            .pipe(
                tap(({ person, knownForTitles }) =>
                    this.seo.setPage(toPersonSeoMetadata(person, knownForTitles, 'photos')),
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
