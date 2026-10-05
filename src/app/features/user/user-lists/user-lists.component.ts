import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import {
    ConfirmationDialogService,
    EmptyStateComponent,
    SkeletonComponent,
    SubPageHeaderComponent,
    RepeatPipe,
    SnackbarService,
    PluralizePipe,
} from '../../../shared';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import { UserListCardSkeletonComponent } from '../user-list-card-skeleton/user-list-card-skeleton.component';
import { UserListSummaryItem, UserListsStore } from '../user-lists-store.service';
import { isSameUserListCover } from '../user-list-cover';
import {
    UserListEditDialogComponent,
    UserListEditDialogData,
} from '../user-list-edit-dialog/user-list-edit-dialog.component';

@Component({
    selector: 'app-user-lists',
    imports: [
        PluralizePipe,
        AsyncPipe,
        MatPaginatorModule,
        EmptyStateComponent,
        SkeletonComponent,
        SubPageHeaderComponent,
        UserListCardComponent,
        UserListCardSkeletonComponent,
        RepeatPipe,
    ],
    templateUrl: './user-lists.component.html',
    styleUrl: './user-lists.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListsComponent {
    readonly userLists$ = this.store.userLists$;

    constructor(
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly dialog: MatDialog,
        private readonly viewportScroller: ViewportScroller,
        private readonly snackbarService: SnackbarService,
        private readonly store: UserListsStore,
    ) {
        this.store
            .load$()
            .pipe(catchError(() => this.snackbarService.showError$('Could not load your lists.')))
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(catchError(() => this.snackbarService.showError$('Could not load your lists.')))
            .subscribe();
    }

    onEditList(item: UserListSummaryItem): void {
        this.dialog
            .open<UserListEditDialogComponent, UserListEditDialogData>(UserListEditDialogComponent, {
                ariaLabelledBy: 'edit-list-title',
                autoFocus: false,
                data: {
                    listId: item.id,
                    cover: item.coverChoice,
                    name: item.name,
                    description: item.description ?? null,
                },
                maxWidth: '40rem',
                panelClass: 'media-list-dialog-panel',
                width: '100%',
            })
            .afterClosed()
            .pipe(
                switchMap((result) => {
                    if (!result) {
                        return EMPTY;
                    }

                    if (
                        result.name === item.name &&
                        result.description === (item.description ?? '') &&
                        isSameUserListCover(result.cover, item.coverChoice)
                    ) {
                        return EMPTY;
                    }

                    return this.store.updateList$(item.id, { ...result, sortBy: result.sortBy ?? item.sortBy }).pipe(
                        tap(() => {
                            this.snackbarService.showSuccess('List details updated.');
                        }),
                    );
                }),
                catchError(() => this.snackbarService.showError$('Could not update this list.')),
            )
            .subscribe();
    }

    onDeleteList(item: UserListSummaryItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Delete ${item.name}?`,
                message: 'This permanently removes the list and every item saved to it from your account.',
                confirmLabel: 'Delete list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.deleteList$(item.id) : EMPTY)),
                tap(() => {
                    this.snackbarService.showSuccess('List deleted.');
                }),
                catchError(() => this.snackbarService.showError$('Could not delete this list.')),
            )
            .subscribe();
    }
}
