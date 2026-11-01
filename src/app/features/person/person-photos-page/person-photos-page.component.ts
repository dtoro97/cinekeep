import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
    CatalogueSubHeaderComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    PhotoViewerDialogService,
    SeoService,
} from '../../../shared';
import { PersonDetailStoreService } from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';

@Component({
    selector: 'app-person-photos-page',
    imports: [AsyncPipe, CatalogueSubHeaderComponent, PhotosBrowserComponent, PhotosBrowserSkeletonComponent],
    templateUrl: './person-photos-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPhotosPageComponent {
    readonly personDetail$ = this.store.personDetail$;

    constructor(
        private store: PersonDetailStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        seoService: SeoService,
    ) {
        this.store.seoSource$
            .pipe(takeUntilDestroyed())
            .subscribe(({ person, knownForTitles }) =>
                seoService.setPage(toPersonSeoMetadata(person, knownForTitles, 'photos')),
            );
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.photoViewerDialogService.open({ images: selection.images, activeIndex: selection.index });
    }
}
