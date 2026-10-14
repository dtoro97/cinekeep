import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, Observable, catchError, switchMap } from 'rxjs';

import {
    BrowseToolbarComponent,
    ConfirmationDialogService,
    EmptyStateComponent,
    EpisodeListItemComponent,
    IconButtonComponent,
    MEDIA_TYPE_OPTIONS,
    MediaListItem,
    MediaListItemComponent,
    MediaRatingDialogService,
    RepeatPipe,
    SelectOption,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { USER_ACCOUNT_SORT_FIELD, USER_ACCOUNT_SORT_OPTIONS } from '../user-list-sort-options';
import {
    UserRatedEpisodeItem,
    UserRatingContentType,
    UserRatingsPageStoreService,
} from './user-ratings-page-store.service';

@Component({
    selector: 'app-user-ratings-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        EpisodeListItemComponent,
        IconButtonComponent,
        MatPaginatorModule,
        MediaListItemComponent,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
        ToggleGroupComponent,
    ],
    providers: [UserRatingsPageStoreService],
    templateUrl: './user-ratings-page.component.html',
    styleUrl: './user-ratings-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRatingsPageComponent {
    readonly contentTypeOptions: SelectOption<UserRatingContentType>[] = [
        ...MEDIA_TYPE_OPTIONS,
        { label: 'Episodes', value: 'episode' },
    ];
    readonly sortOptions = USER_ACCOUNT_SORT_OPTIONS;
    readonly sortField = USER_ACCOUNT_SORT_FIELD;
    readonly skeletonCount = 8;
    readonly ratings$ = this.store.ratings$;

    constructor(
        private readonly store: UserRatingsPageStoreService,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly ratingDialog: MediaRatingDialogService,
        private readonly snackbarService: SnackbarService,
        private readonly viewportScroller: ViewportScroller,
        private readonly destroyRef: DestroyRef,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    setContentType(contentType: UserRatingContentType): void {
        this.store
            .setContentType$(contentType)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    toggleSortDirection(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your ratings.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    editTitleRating(item: MediaListItem): void {
        this.editRating(
            item.title,
            item.rating,
            (value) => this.store.updateTitleRating$(item, value),
            () => this.store.removeTitleRating$(item),
        );
    }

    removeTitleRating(item: MediaListItem): void {
        this.removeRating(item.title, () => this.store.removeTitleRating$(item));
    }

    editEpisodeRating(episode: UserRatedEpisodeItem): void {
        this.editRating(
            episode.title,
            episode.rating,
            (value) => this.store.updateEpisodeRating$(episode, value),
            () => this.store.removeEpisodeRating$(episode),
        );
    }

    removeEpisodeRating(episode: UserRatedEpisodeItem): void {
        this.removeRating(episode.title, () => this.store.removeEpisodeRating$(episode));
    }

    private editRating(
        title: string,
        currentRating: number | null,
        save: (value: number) => Observable<unknown>,
        remove: () => Observable<unknown>,
    ): void {
        this.ratingDialog
            .open$({ title, currentRating, save, remove: () => this.confirmRemoval$(title, remove) })
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private removeRating(title: string, remove: () => Observable<unknown>): void {
        this.confirmRemoval$(title, remove)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not remove your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private confirmRemoval$(title: string, remove: () => Observable<unknown>): Observable<unknown> {
        return this.confirmationDialog
            .confirm$({
                title: `Remove rating for ${title}?`,
                message: 'This removes your rating from this title.',
                confirmLabel: 'Remove rating',
                tone: 'danger',
            })
            .pipe(switchMap((confirmed) => (confirmed ? remove() : EMPTY)));
    }
}
