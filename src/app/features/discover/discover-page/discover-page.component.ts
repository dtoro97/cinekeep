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
    readonly discover$ = this.store.discover$;

    showMobileFilters = false;

    constructor(
        private store: DiscoverStoreService,
        private destroyRef: DestroyRef,
    ) {}

    /** The toolbar controls emit `unknown`, but only ever offer the options passed to them. */
    setMediaType(value: unknown): void {
        this.store.setMediaType(value as MediaType);
    }

    setSortKey(value: unknown): void {
        this.store.setSortKey(value as TmdbDiscoverSortKey);
    }

    toggleSortDirection(): void {
        this.store.toggleSortDirection();
    }

    updateFilter(change: DiscoverFilterChange): void {
        this.store.updateFilter(change);
    }

    clearFilter(filter: DiscoverActiveFilter): void {
        this.store.clearFilter(filter);
    }

    resetFilters(): void {
        this.store.resetFilters();
    }

    loadMore(): void {
        this.store.loadMore$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    openFilters(): void {
        this.showMobileFilters = true;
    }

    @HostListener('document:keydown.escape')
    closeFilters(): void {
        this.showMobileFilters = false;
    }
}
