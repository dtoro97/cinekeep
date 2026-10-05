import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { filter, map, tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    SeoService,
    SkeletonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
    isDefined,
} from '../../../shared';
import { CastCrewGridComponent } from '../cast-crew-grid/cast-crew-grid.component';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
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
    readonly castCrew$ = this.mediaCastPageStoreService.castCrew$;

    constructor(
        mediaStoreService: MediaStoreService,
        private readonly mediaCastPageStoreService: MediaCastPageStoreService,
        seoService: SeoService,
    ) {
        mediaStoreService.mediaDetailsState$
            .pipe(
                takeUntilDestroyed(),
                map((state) => (state.state === 'success' ? state.data : null)),
                filter(isDefined),
                tap((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Cast & Crew'))),
            )
            .subscribe();
    }

    onSectionChange(section: CreditSection): void {
        this.mediaCastPageStoreService.setSection(section);
    }

    onDepartmentChange(department: string): void {
        this.mediaCastPageStoreService.setDepartment(department);
    }

    onQueryInput(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.mediaCastPageStoreService.setQuery(event.target.value);
        }
    }

    clearQuery(): void {
        this.mediaCastPageStoreService.setQuery('');
    }
}
