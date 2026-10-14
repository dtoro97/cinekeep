import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, map, take } from 'rxjs';

import {
    AgePipe,
    CardComponent,
    CardSkeletonComponent,
    ExternalLinksComponent,
    ImageComponent,
    isDefined,
    PageSectionComponent,
    PhotoViewerDialogService,
    RecentlyViewedItem,
    RecentlyViewedStoreService,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    toPersonCardItem,
} from '../../../shared';
import { PersonCreditMediaFilter, PersonDetail, PersonDetailStoreService } from '../person-detail-store.service';
import { toPersonSeoMetadata } from '../person-seo';
import { PersonFilmographyComponent } from './person-filmography/person-filmography.component';

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
        PageSectionComponent,
        PersonFilmographyComponent,
        RepeatPipe,
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
        private readonly photoViewerDialogService: PhotoViewerDialogService,
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

    toggleBiography(): void {
        this.store.toggleBiography();
    }

    setDepartment(department: string): void {
        this.store.setDepartment(department);
    }

    setMediaType(mediaType: PersonCreditMediaFilter): void {
        this.store.setMediaType(mediaType);
    }

    toggleFilmography(): void {
        this.store.toggleFilmography();
    }
}

function toRecentlyViewedItem(person: PersonDetail): RecentlyViewedItem | undefined {
    if (typeof person.id !== 'number') {
        return undefined;
    }

    return { kind: 'person', ...toPersonCardItem(person) };
}
