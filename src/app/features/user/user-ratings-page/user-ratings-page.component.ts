import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, Observable, catchError, switchMap } from 'rxjs';

import {
    BrowseToolbarComponent,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaRatingDialogService,
    ToggleGroupComponent,
    RepeatPipe,
    SelectOption,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    MediaListItemComponent,
    EpisodeListItemComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import { UserRatedEpisodeItem, UserRatingContentType, UserRatingsStore } from '../user-ratings-store.service';

@Component({
    selector: 'app-user-ratings-page',
    imports: [
        AsyncPipe,
        MatPaginatorModule,
        EpisodeListItemComponent,
        MediaListItemComponent,
        BrowseToolbarComponent,
        EmptyStateComponent,
        IconButtonComponent,
        ToggleGroupComponent,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
    ],
    templateUrl: './user-ratings-page.component.html',
    styleUrl: './user-ratings-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserRatingsStore],
})
export class UserRatingsPageComponent {
    readonly contentTypeOptions: SelectOption<UserRatingContentType>[] = [
        ...MEDIA_TYPE_OPTIONS,
        { label: 'Episodes', value: 'episode' },
    ];

    readonly episodeSkeletonCount = 8;
    readonly skeletonCount = 8;
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly ratings$ = this.store.ratings$;

    constructor(
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly destroyRef: DestroyRef,
        private readonly viewportScroller: ViewportScroller,
        private readonly ratingDialog: MediaRatingDialogService,
        private readonly snackbarService: SnackbarService,
        private readonly store: UserRatingsStore,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortDirectionToggle(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onEditMediaRating(item: MediaListItem): void {
        this.openRatingDialog$(
            item.title,
            item.rating,
            (value) => this.store.updateMediaRating$(item, value),
            () => this.store.removeMediaRating$(item),
        )
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveMediaRating(item: MediaListItem): void {
        this.confirmRemoveRating$(item.title)
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.removeMediaRating$(item) : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not remove your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onEditEpisodeRating(item: UserRatedEpisodeItem): void {
        this.openRatingDialog$(
            item.title,
            item.rating,
            (value) => this.store.updateEpisodeRating$(item, value),
            () => this.store.removeEpisodeRating$(item),
        )
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveEpisodeRating(item: UserRatedEpisodeItem): void {
        this.confirmRemoveRating$(item.title)
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.removeEpisodeRating$(item) : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not remove your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private openRatingDialog$(
        title: string,
        currentRating: number | null,
        updateRating: (value: number) => Observable<unknown>,
        removeRating: () => Observable<unknown>,
    ): Observable<unknown> {
        return this.ratingDialog.open$({
            title,
            currentRating,
            save: updateRating,
            remove: () =>
                this.confirmRemoveRating$(title).pipe(switchMap((confirmed) => (confirmed ? removeRating() : EMPTY))),
        });
    }

    private confirmRemoveRating$(title: string): Observable<boolean> {
        return this.confirmationDialog.confirm$({
            title: `Remove rating for ${title}?`,
            message: 'This removes your rating from this title.',
            confirmLabel: 'Remove rating',
            tone: 'danger',
        });
    }

    onContentTypeSelected(value: UserRatingContentType): void {
        this.store
            .setContentType$(value)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
