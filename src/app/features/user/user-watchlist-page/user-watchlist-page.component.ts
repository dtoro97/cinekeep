import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { catchError } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    ToggleGroupComponent,
    RepeatPipe,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    MediaListItemComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserWatchlistStore } from '../user-watchlist-store.service';

@Component({
    selector: 'app-user-watchlist-page',
    imports: [
        AsyncPipe,
        MatPaginatorModule,
        MediaListItemComponent,
        BrowseToolbarComponent,
        EmptyStateComponent,
        IconButtonComponent,
        ToggleGroupComponent,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
    ],
    templateUrl: './user-watchlist-page.component.html',
    styleUrl: './user-watchlist-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserWatchlistStore],
})
export class UserWatchlistPageComponent {
    readonly mediaTypeOptions = MEDIA_TYPE_OPTIONS;

    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly skeletonCount = 8;
    readonly watchlist$ = this.store.watchlist$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly viewportScroller: ViewportScroller,
        private readonly snackbarService: SnackbarService,
        private readonly store: UserWatchlistStore,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortDirectionToggle(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveFromWatchlist(item: MediaListItem): void {
        this.store
            .removeFromWatchlist$(item)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onMediaTypeSelected(value: MediaType): void {
        this.store
            .setMediaType$(value)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
