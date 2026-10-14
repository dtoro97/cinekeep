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
    CardSkeletonComponent,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaType,
    RepeatPipe,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserFavouritesPageStoreService } from './user-favourites-page-store.service';

@Component({
    selector: 'app-user-favourites-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        CardComponent,
        CardSkeletonComponent,
        EmptyStateComponent,
        IconButtonComponent,
        MatPaginatorModule,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
        ToggleGroupComponent,
    ],
    providers: [UserFavouritesPageStoreService],
    templateUrl: './user-favourites-page.component.html',
    styleUrl: './user-favourites-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFavouritesPageComponent {
    readonly mediaTypeOptions = MEDIA_TYPE_OPTIONS;
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly posterImageParams = 'w342';
    readonly skeletonCount = PAGE_SIZE;
    readonly favourites$ = this.store.favourites$;

    constructor(
        private readonly store: UserFavouritesPageStoreService,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly snackbarService: SnackbarService,
        private readonly viewportScroller: ViewportScroller,
        private readonly destroyRef: DestroyRef,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    setMediaType(mediaType: MediaType): void {
        this.store
            .setMediaType$(mediaType)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    toggleSortDirection(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    remove(item: CardItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Remove ${item.title} from favorites?`,
                message: 'This removes the title from your favorites only.',
                confirmLabel: 'Remove favorite',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.remove$(item) : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not update your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
