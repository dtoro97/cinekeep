import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { filter } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    isDefined,
    SeoService,
    SkeletonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
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
        SkeletonComponent,
        SubPageHeaderComponent,
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
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Cast & Crew')));
    }

    setSection(section: CreditSection): void {
        this.store.setSection(section);
    }

    setDepartment(department: string): void {
        this.store.setDepartment(department);
    }

    setQuery(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.store.setQuery(event.target.value);
        }
    }

    clearQuery(): void {
        this.store.setQuery('');
    }
}
