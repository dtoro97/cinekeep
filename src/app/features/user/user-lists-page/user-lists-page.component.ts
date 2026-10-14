import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import {
    ConfirmationDialogService,
    EmptyStateComponent,
    PluralizePipe,
    RepeatPipe,
    SkeletonComponent,
    SnackbarService,
    SubPageHeaderComponent,
} from '../../../shared';
import { UserListCardSkeletonComponent } from '../user-list-card-skeleton/user-list-card-skeleton.component';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import { UserListEditDialogComponent } from '../user-list-edit-dialog/user-list-edit-dialog.component';
import {
    UserListEditDialogData,
    UserListEditDialogResult,
} from '../user-list-edit-dialog/user-list-edit-dialog-store.service';
import { UserListSummaryItem } from '../user-list-summary.mapper';
import { UserListsPageStoreService } from './user-lists-page-store.service';

@Component({
    selector: 'app-user-lists-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        MatPaginatorModule,
        PluralizePipe,
        RepeatPipe,
        SkeletonComponent,
        SubPageHeaderComponent,
        UserListCardComponent,
        UserListCardSkeletonComponent,
    ],
    providers: [UserListsPageStoreService],
    templateUrl: './user-lists-page.component.html',
    styleUrl: './user-lists-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListsPageComponent {
    readonly skeletonCount = 5;
    readonly userLists$ = this.store.userLists$;

    constructor(
        private readonly store: UserListsPageStoreService,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly matDialog: MatDialog,
        private readonly snackbarService: SnackbarService,
        private readonly viewportScroller: ViewportScroller,
        private readonly destroyRef: DestroyRef,
    ) {
        this.store
            .loadPage$(0)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your lists.')),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load your lists.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    editList(list: UserListSummaryItem): void {
        this.matDialog
            .open<UserListEditDialogComponent, UserListEditDialogData, UserListEditDialogResult>(
                UserListEditDialogComponent,
                {
                    ariaLabelledBy: 'edit-list-title',
                    autoFocus: false,
                    data: {
                        listId: list.id,
                        cover: list.coverChoice,
                        name: list.name,
                        description: list.description,
                    },
                    maxWidth: '40rem',
                    panelClass: 'media-list-dialog-panel',
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                switchMap((changes) => (changes ? this.store.updateList$(list, changes) : EMPTY)),
                tap(() => this.snackbarService.showSuccess('List details updated.')),
                catchError(() => this.snackbarService.showError$('Could not update this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    deleteList(list: UserListSummaryItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Delete ${list.name}?`,
                message: 'This permanently removes the list and every item saved to it from your account.',
                confirmLabel: 'Delete list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.deleteList$(list) : EMPTY)),
                tap(() => this.snackbarService.showSuccess('List deleted.')),
                catchError(() => this.snackbarService.showError$('Could not delete this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
