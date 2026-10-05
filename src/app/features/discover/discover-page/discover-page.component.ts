import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
    CardComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    LibraryToggleComponent,
    MediaType,
    RepeatPipe,
    SortButtonComponent,
    TmdbDiscoverSortKey,
    ToggleGroupComponent,
} from '../../../shared';
import { DiscoverFilterPanelComponent } from './discover-filter-panel/discover-filter-panel.component';
import { DiscoverActiveFilter, DiscoverFilterChange, DiscoverStoreService } from './discover-store.service';

@Component({
    selector: 'app-discover-page',
    imports: [
        A11yModule,
        AsyncPipe,
        CardComponent,
        CardSkeletonComponent,
        DiscoverFilterPanelComponent,
        EmptyStateComponent,
        LibraryToggleComponent,
        MatButtonModule,
        MatIconModule,
        NgTemplateOutlet,
        RepeatPipe,
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

    showMobileFilters = false;

    constructor(
        private readonly discoverStoreService: DiscoverStoreService,
        private readonly destroyRef: DestroyRef,
    ) {}

    setMediaType(value: MediaType): void {
        this.discoverStoreService.setMediaType(value);
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

    openFilters(): void {
        this.showMobileFilters = true;
    }

    @HostListener('document:keydown.escape')
    closeFilters(): void {
        this.showMobileFilters = false;
    }
}
