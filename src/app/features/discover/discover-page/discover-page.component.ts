import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
    CardComponent,
    EmptyStateComponent,
    LibraryToggleComponent,
    ToggleGroupComponent,
    RepeatPipe,
    SkeletonComponent,
    SortButtonComponent,
} from '../../../shared';
import {
    DiscoverActiveFilter,
    DiscoverStoreService,
} from '../discover-store.service';
import { DiscoverFilterPanelComponent } from '../discover-filter-panel/discover-filter-panel.component';
import { DiscoverFilterChange } from '../discover-page-definitions';

@Component({
    selector: 'app-discover-page',
    imports: [
        A11yModule,
        AsyncPipe,
        CardComponent,
        DiscoverFilterPanelComponent,
        EmptyStateComponent,
        LibraryToggleComponent,
        MatButtonModule,
        MatIconModule,
        NgTemplateOutlet,
        ToggleGroupComponent,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
    ],
    providers: [DiscoverStoreService],
    templateUrl: './discover-page.component.html',
    styleUrl: './discover-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverPageComponent {
    readonly vm$ = this.store.vm$;
    mobileFiltersOpen = false;

    readonly skeletonCount = 20;
    readonly loadMoreSkeletonCount = 5;

    constructor(private readonly store: DiscoverStoreService) {}

    onMediaTypeChange(value: unknown): void {
        this.store.updateMediaType(value);
    }

    onSortChange(value: unknown): void {
        this.store.updateSort(value);
    }

    onSortDirectionToggle(): void {
        this.store.toggleSortDirection();
    }

    onFilterChange(change: DiscoverFilterChange): void {
        this.store.updateFilter(change);
    }

    clearFilter(filter: DiscoverActiveFilter): void {
        this.store.clearFilter(filter);
    }

    reset(): void {
        this.store.reset();
    }

    openFilters(): void {
        this.mobileFiltersOpen = true;
    }

    closeFilters(): void {
        this.mobileFiltersOpen = false;
    }

    loadMore(): void {
        this.store.loadMore();
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        this.closeFilters();
    }
}
