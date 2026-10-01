import { AsyncPipe, DatePipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { distinctUntilChanged, map, take, tap } from 'rxjs';

import {
    AgePipe,
    ImageComponent,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    ExternalLinksComponent,
    MediaCarouselPanelComponent,
    RecentlyViewedStoreService,
    SeoService,
    SkeletonComponent,
} from '../../../shared';
import {
    PersonDetailStoreService,
    PersonCreditsMediaType,
    PersonCreditsSortBy,
} from '../person-detail-store.service';
import { PersonCreditsComponent } from '../person-credits/person-credits.component';
import { toPersonSeoMetadata } from '../person-seo';

@Component({
    selector: 'app-person-details',
    imports: [
        AsyncPipe,
        DatePipe,
        SlicePipe,
        RouterLink,
        MatDialogModule,
        ImageComponent,
        PhotosPreviewComponent,
        ExternalLinksComponent,
        AgePipe,
        PageSectionComponent,
        PersonCreditsComponent,
        MediaCarouselPanelComponent,
        SkeletonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './person-details.component.html',
    styleUrl: './person-details.component.scss',
})
export class PersonDetailsComponent {
    readonly aliasPreviewCount = 3;
    readonly bioPreviewThreshold = 300;
    bioExpanded = false;

    constructor(
        public personDetailStore: PersonDetailStoreService,
        private dialog: MatDialog,
        private recentlyViewedStore: RecentlyViewedStoreService,
        private router: Router,
        private destroyRef: DestroyRef,
        private readonly seo: SeoService,
    ) {
        this.personDetailStore.seoSource$
            .pipe(
                tap(({ person, knownForTitles }) =>
                    this.seo.setPage(toPersonSeoMetadata(person, knownForTitles, 'overview')),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();

        this.personDetailStore.personDetailVm$
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                map((vm) => (vm.person.state === 'success' ? vm.person.data : null)),
                distinctUntilChanged((previous, current) => previous?.id === current?.id),
                tap((person) => {
                    this.bioExpanded = false;

                    if (!person || typeof person.id !== 'number') {
                        return;
                    }

                    this.recentlyViewedStore.addItem({
                        kind: 'person',
                        id: person.id,
                        name: person.name ?? '',
                        imagePath: person.profile_path ?? null,
                        subtitle: person.known_for_department ?? '',
                    });
                }),
            )
            .subscribe();
    }

    openPhotoViewer(index: number): void {
        this.personDetailStore.personDetailVm$.pipe(take(1)).subscribe((vm) => {
            if (vm.person.state !== 'success' || !vm.person.data || vm.photos.state !== 'success') {
                return;
            }

            const person = vm.person.data;
            const allPhotos = vm.photos.data;

            this.dialog.open(PhotoViewerComponent, {
                data: {
                    images: allPhotos,
                    activeIndex: index,
                    photosLink: ['/name', person.id, 'photos'],
                },
                panelClass: 'photo-viewer-panel',
                maxWidth: '100vw',
                maxHeight: '100vh',
                width: '100vw',
                height: '100vh',
                autoFocus: false,
            });
        });
    }

    openPhotosPage(): void {
        this.personDetailStore.personDetailVm$.pipe(take(1)).subscribe((vm) => {
            if (vm.person.state !== 'success' || !vm.person.data) {
                return;
            }

            this.router.navigate(['/name', vm.person.data.id, 'photos']);
        });
    }

    toggleBio(): void {
        this.bioExpanded = !this.bioExpanded;
    }

    onCreditsMediaTypeChange(value: PersonCreditsMediaType): void {
        this.personDetailStore.setCreditsMediaType(value);
    }

    onCreditsSortByChange(value: PersonCreditsSortBy): void {
        this.personDetailStore.setCreditsSortBy(value);
    }

    resetCreditsFilters(): void {
        this.personDetailStore.resetCreditsFilters();
    }

    toggleCreditsSortDirection(): void {
        this.personDetailStore.toggleCreditsSortDirection();
    }

    toggleActingCredits(): void {
        this.personDetailStore.toggleActingCredits();
    }

    toggleProductionCredits(): void {
        this.personDetailStore.toggleProductionCredits();
    }
}
