import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { filter, map, take } from 'rxjs';

import {
    AgePipe,
    ExternalLinksComponent,
    ImageComponent,
    isDefined,
    MediaCarouselPanelComponent,
    PageSectionComponent,
    PhotosPreviewComponent,
    PHOTO_VIEWER_DIALOG_CONFIG,
    PhotoViewerComponent,
    RecentlyViewedItem,
    RecentlyViewedStoreService,
    SeoService,
    SkeletonComponent,
    toPersonCardItem,
} from '../../../shared';
import { PersonCreditsComponent } from '../person-credits/person-credits.component';
import {
    PersonCreditMediaFilter,
    PersonCreditSectionKey,
    PersonCreditSortBy,
    PersonDetail,
    PersonDetailStoreService,
} from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';

@Component({
    selector: 'app-person-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        RouterLink,
        MatDialogModule,
        AgePipe,
        ExternalLinksComponent,
        ImageComponent,
        MediaCarouselPanelComponent,
        PageSectionComponent,
        PersonCreditsComponent,
        PhotosPreviewComponent,
        SkeletonComponent,
    ],
    templateUrl: './person-detail-page.component.html',
    styleUrl: './person-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailPageComponent {
    readonly personDetail$ = this.store.personDetail$;

    constructor(
        private store: PersonDetailStoreService,
        private matDialog: MatDialog,
        private router: Router,
        seoService: SeoService,
        recentlyViewedStoreService: RecentlyViewedStoreService,
    ) {
        this.store.seoSource$
            .pipe(takeUntilDestroyed())
            .subscribe(({ person, knownForTitles }) =>
                seoService.setPage(toPersonSeoMetadata(person, knownForTitles, 'overview')),
            );

        this.store.loadedPerson$
            .pipe(map(toRecentlyViewedItem), filter(isDefined), takeUntilDestroyed())
            .subscribe((item) => recentlyViewedStoreService.addItem(item));
    }

    openPhotoViewer(index: number): void {
        this.personDetail$.pipe(take(1)).subscribe(({ photos, photosLink }) => {
            if (photos.state !== 'success' || !photosLink) {
                return;
            }

            this.matDialog.open(PhotoViewerComponent, {
                ...PHOTO_VIEWER_DIALOG_CONFIG,
                data: { images: photos.data, activeIndex: index, photosLink },
            });
        });
    }

    openPhotosPage(): void {
        this.personDetail$.pipe(take(1)).subscribe(({ photosLink }) => {
            if (photosLink) {
                this.router.navigate(photosLink);
            }
        });
    }

    toggleBiography(): void {
        this.store.toggleBiography();
    }

    setCreditMediaType(mediaType: PersonCreditMediaFilter): void {
        this.store.setCreditMediaType(mediaType);
    }

    setCreditSortBy(sortBy: PersonCreditSortBy): void {
        this.store.setCreditSortBy(sortBy);
    }

    toggleCreditSortDirection(): void {
        this.store.toggleCreditSortDirection();
    }

    toggleCreditSection(section: PersonCreditSectionKey): void {
        this.store.toggleCreditSection(section);
    }

    resetCreditFilters(): void {
        this.store.resetCreditFilters();
    }
}

function toRecentlyViewedItem(person: PersonDetail): RecentlyViewedItem | undefined {
    if (typeof person.id !== 'number') {
        return undefined;
    }

    return { kind: 'person', ...toPersonCardItem(person) };
}
