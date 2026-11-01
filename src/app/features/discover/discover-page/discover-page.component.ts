import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import {
    CardComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    ImageComponent,
    LibraryToggleComponent,
    MediaType,
    RepeatPipe,
    SkeletonComponent,
    SortButtonComponent,
    TmdbDiscoverSortKey,
    ToggleGroupComponent,
} from '../../../shared';
import type { DiscoverView } from '../discover-page-definitions';
import { DiscoverFilterPanelComponent } from './discover-filter-panel/discover-filter-panel.component';
import {
    DiscoverActiveFilter,
    DiscoverFilterChange,
    DiscoverFilterGroup,
    DiscoverStoreService,
} from './discover-store.service';

@Component({
    selector: 'app-discover-page',
    imports: [
        A11yModule,
        AsyncPipe,
        CardComponent,
        CardSkeletonComponent,
        CdkConnectedOverlay,
        CdkOverlayOrigin,
        DatePipe,
        DecimalPipe,
        DiscoverFilterPanelComponent,
        EmptyStateComponent,
        ImageComponent,
        LibraryToggleComponent,
        MatButtonModule,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        SortButtonComponent,
        ToggleGroupComponent,
    ],
    providers: [DiscoverStoreService],
    templateUrl: './discover-page.component.html',
    styleUrl: './discover-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverPageComponent {
    readonly discover$ = this.discoverStoreService.discover$;

    openFilter: { group: DiscoverFilterGroup; label: string; origin: CdkOverlayOrigin } | null = null;

    constructor(
        private readonly discoverStoreService: DiscoverStoreService,
        private readonly destroyRef: DestroyRef,
    ) {}

    toggleFilter(group: DiscoverFilterGroup, label: string, origin: CdkOverlayOrigin): void {
        this.openFilter = this.openFilter?.group === group ? null : { group, label, origin };
    }

    closeFilter(): void {
        this.openFilter = null;
    }

    closeFilterOnEscape(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.closeFilter();
        }
    }

    setMediaType(value: MediaType): void {
        this.discoverStoreService.setMediaType(value);
    }

    setView(view: DiscoverView): void {
        this.discoverStoreService.setView(view);
    }

    setSortKey(value: TmdbDiscoverSortKey): void {
        this.discoverStoreService.setSortKey(value);
    }

    toggleSortDirection(): void {
        this.discoverStoreService.toggleSortDirection();
    }

    updateFilter(change: DiscoverFilterChange): void {
        this.discoverStoreService.updateFilter(change);
    }

    clearFilter(filter: DiscoverActiveFilter): void {
        this.discoverStoreService.clearFilter(filter);
    }

    resetFilters(): void {
        this.discoverStoreService.resetFilters();
    }

    loadMore(): void {
        this.discoverStoreService.loadMore$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
