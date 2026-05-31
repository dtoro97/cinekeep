import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EMPTY, Observable, catchError, distinctUntilChanged, map, switchMap, take, tap } from 'rxjs';

import { V4ListSortBy } from '../../../api-v4';
import {
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    PageScrollService,
    RepeatPipe,
    SeoService,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SubPageHeaderComponent,
    UserAvatarComponent,
} from '../../../shared';
import { AccountMediaItemComponent } from '../account-media-item/account-media-item.component';
import {
    UserListAddItemsDialogComponent,
    UserListAddItemsDialogData,
} from '../user-list-add-items-dialog/user-list-add-items-dialog.component';
import {
    UserListEditDialogComponent,
    UserListEditDialogData,
} from '../user-list-edit-dialog/user-list-edit-dialog.component';
import { UserListDetailHeader, UserListDetailItem, UserListDetailStore } from '../user-list-detail-store.service';
import { USER_LIST_SORT_OPTIONS } from '../user-list-sort-options';

@Component({
    selector: 'app-user-list-detail-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatPaginatorModule,
        MatSelectModule,
        MatTooltipModule,
        AccountMediaItemComponent,
        IconButtonComponent,
        RepeatPipe,
        SubPageHeaderComponent,
        UserAvatarComponent,
    ],
    templateUrl: './user-list-detail-page.component.html',
    styleUrl: './user-list-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserListDetailStore],
})
export class UserListDetailPageComponent {
    readonly vm$ = this.store.userListDetailVm$;
    readonly backLink = ['/', 'me', 'lists'];
    readonly initialSkeletonCount = 6;
    readonly sortOptions = USER_LIST_SORT_OPTIONS;
    readonly editingCommentKey = signal<string | null>(null);
    readonly commentDraft = signal('');

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly dialog: MatDialog,
        private readonly pageScroll: PageScrollService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly seo: SeoService,
        private readonly snackbar: SnackbarService,
        private readonly store: UserListDetailStore,
    ) {
        this.route.paramMap
            .pipe(
                map((params) => Number(params.get('listId'))),
                distinctUntilChanged(),
                switchMap((listId) => this.store.loadList$(listId)),
                catchError(() => {
                    this.router.navigate(['not-found']);
                    return EMPTY;
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();

        this.vm$
            .pipe(
                tap((vm) => {
                    if (vm.header.state === 'success') {
                        this.seo.setPage({
                            title: `${vm.header.data.name} | List`,
                            description:
                                vm.header.data.description ||
                                'Your saved movies and TV series in one CineKeep list.',
                            robots: 'noindex, nofollow',
                        });
                        return;
                    }

                    this.seo.setPage({
                        title: 'List',
                        robots: 'noindex, nofollow',
                    });
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onPageChange(event: PageEvent): void {
        this.pageScroll.scrollToTop();

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                take(1),
                catchError(() => this.showError('Could not load list items.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onAddTitles(listId: number, existingKeys: readonly string[]): void {
        this.dialog
            .open<UserListAddItemsDialogComponent, UserListAddItemsDialogData, true | undefined>(
                UserListAddItemsDialogComponent,
                {
                    autoFocus: false,
                    data: { listId, existingKeys },
                    maxWidth: '42rem',
                    panelClass: ['media-list-dialog-panel', 'user-list-add-items-dialog-panel'],
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                take(1),
                switchMap((changed) => (changed ? this.store.reload$() : EMPTY)),
                catchError(() => this.showError('Could not refresh this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onEditDetails(header: UserListDetailHeader, isPublic: boolean, defaultSortBy: V4ListSortBy): void {
        this.dialog
            .open<UserListEditDialogComponent, UserListEditDialogData>(UserListEditDialogComponent, {
                autoFocus: false,
                data: {
                    name: header.name,
                    description: header.description,
                    isPublic,
                    sortBy: defaultSortBy,
                },
                maxWidth: '34rem',
                panelClass: 'media-list-dialog-panel',
                width: '100%',
            })
            .afterClosed()
            .pipe(
                take(1),
                switchMap((result) => {
                    if (!result) {
                        return EMPTY;
                    }

                    if (
                        result.name === header.name &&
                        result.description === (header.description ?? '') &&
                        result.isPublic === isPublic &&
                        result.sortBy === defaultSortBy
                    ) {
                        return EMPTY;
                    }

                    return this.store.updateList$(result).pipe(
                        tap(() => {
                            this.showSuccess('List details updated.');
                        }),
                    );
                }),
                catchError(() => this.showError('Could not update this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortChange(sortBy: V4ListSortBy): void {
        if (!this.sortOptions.some((option) => option.value === sortBy)) {
            return;
        }

        this.store
            .setSortBy$(sortBy)
            .pipe(
                take(1),
                catchError(() => this.showError('Could not update list sorting.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onClearList(): void {
        this.confirmationDialog
            .confirm$({
                title: 'Clear this list?',
                message:
                    'Every title will be removed, but the list itself will stay in place so you can reuse it.',
                confirmLabel: 'Clear list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.clearList$() : EMPTY)),
                tap(() => {
                    this.showSuccess('List cleared.');
                }),
                catchError(() => this.showError('Could not clear this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onDeleteList(): void {
        this.confirmationDialog
            .confirm$({
                title: 'Delete this list?',
                message:
                    'This permanently removes the list and every item saved to it from your account.',
                confirmLabel: 'Delete list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.deleteList$() : EMPTY)),
                tap(() => {
                    this.router.navigate(this.backLink);
                    this.showSuccess('List deleted.');
                }),
                catchError(() => this.showError('Could not delete this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onRemoveItem(item: UserListDetailItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Remove ${item.title}?`,
                message: 'This removes the title from this list only.',
                confirmLabel: 'Remove item',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.removeItem$(item) : EMPTY)),
                tap(() => {
                    this.showSuccess('Item removed from the list.');
                }),
                catchError(() => this.showError('Could not remove this item.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onStartComment(item: UserListDetailItem): void {
        this.editingCommentKey.set(item.key);
        this.commentDraft.set(item.comment);
    }

    onCancelComment(): void {
        this.editingCommentKey.set(null);
        this.commentDraft.set('');
    }

    onCommentDraftInput(event: Event): void {
        const target = event.target;

        if (target instanceof HTMLTextAreaElement) {
            this.commentDraft.set(target.value);
        }
    }

    onSaveComment(item: UserListDetailItem): void {
        const comment = this.commentDraft().trim();

        if (comment === item.comment) {
            this.onCancelComment();
            return;
        }

        this.store
            .updateItemComment$(item, comment)
            .pipe(
                take(1),
                tap(() => {
                    this.onCancelComment();
                    this.showSuccess('Comment updated.');
                }),
                catchError(() => this.showError('Could not update this comment.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private showSuccess(message: string): void {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Success,
        });
    }

    private showError(message: string): Observable<never> {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
