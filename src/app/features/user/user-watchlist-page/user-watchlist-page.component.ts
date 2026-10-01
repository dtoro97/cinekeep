import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, Observable, catchError } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaType,
    PageScrollService,
    ToggleGroupComponent,
    RepeatPipe,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SortButtonComponent,
    SubPageHeaderComponent,
} from '../../../shared';
import { AccountMediaItemComponent } from '../account-media-item/account-media-item.component';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserWatchlistStore } from '../user-watchlist-store.service';

@Component({
    selector: 'app-user-watchlist-page',
    imports: [
        AsyncPipe,
        MatPaginatorModule,
        AccountMediaItemComponent,
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
    readonly vm$ = this.store.watchlistPageViewModel$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly pageScroll: PageScrollService,
        private readonly snackbar: SnackbarService,
        private readonly store: UserWatchlistStore,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.showError('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortDirectionToggle(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.showError('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveFromWatchlist(item: MediaListItem): void {
        this.store
            .removeFromWatchlist$(item)
            .pipe(
                catchError(() => this.showError('Could not update your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onMediaTypeSelected(value: MediaType): void {
        this.store
            .setMediaType$(value)
            .pipe(
                catchError(() => this.showError('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.pageScroll.scrollToTop();

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.showError('Could not load your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private showError(message: string): Observable<never> {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
