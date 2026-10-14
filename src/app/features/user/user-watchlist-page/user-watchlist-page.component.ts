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
    MediaListItemComponent,
    MediaType,
    RepeatPipe,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserWatchlistPageStoreService } from './user-watchlist-page-store.service';

@Component({
    selector: 'app-user-watchlist-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        IconButtonComponent,
        MatPaginatorModule,
        MediaListItemComponent,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
        ToggleGroupComponent,
    ],
    providers: [UserWatchlistPageStoreService],
    templateUrl: './user-watchlist-page.component.html',
    styleUrl: './user-watchlist-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserWatchlistPageComponent {
    readonly mediaTypeOptions = MEDIA_TYPE_OPTIONS;
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly skeletonCount = 8;
    readonly watchlist$ = this.store.watchlist$;

    constructor(
        private readonly store: UserWatchlistPageStoreService,
        private readonly snackbarService: SnackbarService,
        private readonly viewportScroller: ViewportScroller,
        private readonly destroyRef: DestroyRef,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    setMediaType(mediaType: MediaType): void {
        this.store
            .setMediaType$(mediaType)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    toggleSortDirection(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    remove(item: MediaListItem): void {
        this.store
            .remove$(item)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
