import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { filter } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    isDefined,
    PageSectionComponent,
    SeoService,
    SkeletonComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { MediaSubPageHeaderComponent } from '../media-sub-page-header/media-sub-page-header.component';
import { CastCrewGridComponent } from './cast-crew-grid/cast-crew-grid.component';
import { CreditSection, MediaCastPageStoreService } from './media-cast-page-store.service';

@Component({
    selector: 'app-media-cast-crew',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        CastCrewGridComponent,
        EmptyStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MediaSubPageHeaderComponent,
        PageSectionComponent,
        RouterLink,
        SkeletonComponent,
        ToggleGroupComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [MediaCastPageStoreService],
    templateUrl: './media-cast-page.component.html',
    styleUrl: './media-cast-page.component.scss',
})
export class MediaCastPageComponent {
    readonly castCrew$ = this.store.castCrew$;

    constructor(
        private readonly store: MediaCastPageStoreService,
        mediaStore: MediaStoreService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store.load$(activatedRoute.paramMap).pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Cast & Crew')));
    }

    setSection(section: CreditSection): void {
        this.store.setSection(section);
    }

    setQuery(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.store.setQuery(event.target.value);
        }
    }

    clearQuery(): void {
        this.store.setQuery('');
    }

    showAllCast(): void {
        this.store.showAllCast();
    }

    expandDepartment(departmentId: string): void {
        this.store.expandDepartment(departmentId);
    }
}
