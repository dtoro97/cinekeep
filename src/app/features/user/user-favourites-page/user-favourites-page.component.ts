import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, Observable, catchError, switchMap } from 'rxjs';

import {
    BrowseToolbarComponent,
    CardComponent,
    CardItem,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaType,
    PageScrollService,
    ToggleGroupComponent,
    RepeatPipe,
    CardSkeletonComponent,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
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
    readonly skeletonCount = 20;
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly vm$ = this.store.favouritesPageViewModel$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly pageScroll: PageScrollService,
        private readonly snackbar: SnackbarService,
        private readonly store: UserFavouritesStore,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.showError('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortDirectionToggle(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.showError('Could not load your favorites.')),
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
                catchError(() => this.showError('Could not update your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onMediaTypeSelected(value: MediaType): void {
        this.store
            .setMediaType$(value)
            .pipe(
                catchError(() => this.showError('Could not load your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.pageScroll.scrollToTop();

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.showError('Could not load your favorites.')),
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
