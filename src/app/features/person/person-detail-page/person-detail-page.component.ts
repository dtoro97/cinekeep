import { AsyncPipe, DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { filter, map, take } from 'rxjs';

import {
    AgePipe,
    CardComponent,
    CardSkeletonComponent,
    ExternalLinksComponent,
    ImageComponent,
    isDefined,
    LibraryToggleComponent,
    PhotosPreviewComponent,
    PhotoViewerDialogService,
    RecentlyViewedItem,
    RecentlyViewedStoreService,
    RepeatPipe,
    scrollToSection,
    SeoService,
    SkeletonComponent,
    toPersonCardItem,
    watchActiveSectionId$,
} from '../../../shared';
import {
    PersonCreditMediaFilter,
    PersonCreditSectionKey,
    PersonCreditSortBy,
    PersonDetail,
    PersonDetailStoreService,
} from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';
import { PersonCreditsComponent } from './person-credits/person-credits.component';

@Component({
    selector: 'app-person-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        RouterLink,
        AgePipe,
        CardComponent,
        CardSkeletonComponent,
        ExternalLinksComponent,
        ImageComponent,
        LibraryToggleComponent,
        PersonCreditsComponent,
        PhotosPreviewComponent,
        RepeatPipe,
        SkeletonComponent,
    ],
    templateUrl: './person-detail-page.component.html',
    styleUrl: './person-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailPageComponent {
    readonly personDetail$ = this.store.personDetail$;

    readonly activeSectionId$ = watchActiveSectionId$(
        this.document,
        this.platformId,
        this.personDetail$.pipe(map(({ sectionIndex }) => sectionIndex.map((section) => section.id))),
    );

    constructor(
        private store: PersonDetailStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private router: Router,
        @Inject(DOCUMENT) private readonly document: Document,
        @Inject(PLATFORM_ID) private readonly platformId: object,
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

            this.photoViewerDialogService.open({ images: photos.data, activeIndex: index, photosLink });
        });
    }

    openPhotosPage(): void {
        this.personDetail$.pipe(take(1)).subscribe(({ photosLink }) => {
            if (photosLink) {
                this.router.navigate(photosLink);
            }
        });
    }

    scrollToSection(id: string): void {
        scrollToSection(this.document, id);
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
