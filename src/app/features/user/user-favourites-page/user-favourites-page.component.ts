import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, catchError, switchMap } from 'rxjs';

import { PAGE_SIZE } from '../../../constants';
import {
    BrowseToolbarComponent,
    CardComponent,
    CardItem,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaType,
    ToggleGroupComponent,
    RepeatPipe,
    CardSkeletonComponent,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserFavouritesStore } from '../user-favourites-store.service';

@Component({
    selector: 'app-user-favourites-page',
    imports: [
        AsyncPipe,
        MatPaginatorModule,
        BrowseToolbarComponent,
        CardComponent,
        EmptyStateComponent,
        IconButtonComponent,
        ToggleGroupComponent,
        RepeatPipe,
        CardSkeletonComponent,
        SortButtonComponent,
        SubPageHeaderComponent,
    ],
    templateUrl: './user-favourites-page.component.html',
    styleUrl: './user-favourites-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserFavouritesStore],
})
export class UserFavouritesPageComponent {
    readonly mediaTypeOptions = MEDIA_TYPE_OPTIONS;

    readonly posterImageParams = 'w342';
    readonly skeletonCount = PAGE_SIZE;
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly favourites$ = this.store.favourites$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly viewportScroller: ViewportScroller,
        private readonly snackbarService: SnackbarService,
        private readonly store: UserFavouritesStore,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortDirectionToggle(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveFromFavourites(item: CardItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Remove ${item.title} from favorites?`,
                message: 'This removes the title from your favorites only.',
                confirmLabel: 'Remove favorite',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.removeFromFavourites$(item) : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not update your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onMediaTypeSelected(value: MediaType): void {
        this.store
            .setMediaType$(value)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
