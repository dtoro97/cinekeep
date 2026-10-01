import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import {
    ConfirmationDialogService,
    EmptyStateComponent,
    PageScrollService,
    SkeletonComponent,
    SubPageHeaderComponent,
    RepeatPipe,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
} from '../../../shared';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import { UserListCardSkeletonComponent } from '../user-list-card-skeleton/user-list-card-skeleton.component';
import { UserListSummaryItem, UserListsStore } from '../user-lists-store.service';
import {
    UserListEditDialogComponent,
    UserListEditDialogData,
} from '../user-list-edit-dialog/user-list-edit-dialog.component';

@Component({
    selector: 'app-user-lists',
    imports: [
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
    readonly vm$ = this.store.listsViewModel$;

    constructor(
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly dialog: MatDialog,
        private readonly pageScroll: PageScrollService,
        private readonly snackbar: SnackbarService,
        private readonly store: UserListsStore,
    ) {
        this.store
            .load$()
            .pipe(
                catchError(() => this.showError('Could not load your lists.')),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.pageScroll.scrollToTop();

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.showError('Could not load your lists.')),
            )
            .subscribe();
    }

    onEditList(item: UserListSummaryItem): void {
        this.dialog
            .open<UserListEditDialogComponent, UserListEditDialogData>(UserListEditDialogComponent, {
                autoFocus: false,
                data: {
                    name: item.name,
                    description: item.description ?? null,
                    isPublic: item.isPublic,
                },
                maxWidth: '34rem',
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
                        result.isPublic === item.isPublic
                    ) {
                        return EMPTY;
                    }

                    return this.store
                        .updateList$(item.id, { ...result, sortBy: result.sortBy ?? item.sortBy })
                        .pipe(
                        tap(() => {
                            this.showSuccess('List details updated.');
                        }),
                    );
                }),
                catchError(() => this.showError('Could not update this list.')),
            )
            .subscribe();
    }

    onDeleteList(item: UserListSummaryItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Delete ${item.name}?`,
                message:
                    'This permanently removes the list and every item saved to it from your account.',
                confirmLabel: 'Delete list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.deleteList$(item.id) : EMPTY)),
                tap(() => {
                    this.showSuccess('List deleted.');
                }),
                catchError(() => this.showError('Could not delete this list.')),
            )
            .subscribe();
    }

    private showSuccess(message: string): void {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Success,
        });
    }

    private showError(message: string) {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
