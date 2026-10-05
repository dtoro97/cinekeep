import { AsyncPipe, ViewportScroller } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    input,
    numberAttribute,
    signal,
    viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EMPTY, catchError, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    RepeatPipe,
    SeoService,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
    MediaListItemComponent,
} from '../../../shared';
import {
    UserListAddItemsDialogComponent,
    UserListAddItemsDialogData,
} from '../user-list-add-items-dialog/user-list-add-items-dialog.component';
import {
    UserListEditDialogComponent,
    UserListEditDialogData,
} from '../user-list-edit-dialog/user-list-edit-dialog.component';
import { UserListResponse } from '../../../api-cinekeep';
import { UserListDetailHeader, UserListDetailItem, UserListDetailStore } from '../user-list-detail-store.service';
import { isSameUserListCover } from '../user-list-cover';
import { USER_LIST_SORT_FIELD_OPTIONS, UserListSort, toUserListSortBy } from '../user-list-sort-options';

@Component({
    selector: 'app-user-list-detail-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatPaginatorModule,
        SortButtonComponent,
        MatTooltipModule,
        MediaListItemComponent,
        IconButtonComponent,
        RepeatPipe,
        SubPageHeaderComponent,
    ],
    templateUrl: './user-list-detail-page.component.html',
    styleUrl: './user-list-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserListDetailStore],
})
export class UserListDetailPageComponent {
    readonly listId = input.required({ transform: numberAttribute });
    readonly userListDetail$ = this.store.userListDetail$;
    readonly backLink = ['/', 'me', 'lists'];
    readonly initialSkeletonCount = 6;
    readonly sortFieldOptions = USER_LIST_SORT_FIELD_OPTIONS;
    readonly editingCommentKey = signal<string | null>(null);
    readonly commentDraft = signal('');
    readonly commentPending = signal(false);
    readonly commentSaveLabel = computed(() => (this.commentPending() ? 'Saving…' : 'Save'));
    private readonly commentInput = viewChild<ElementRef<HTMLTextAreaElement>>('commentInput');

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly injector: Injector,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly dialog: MatDialog,
        private readonly viewportScroller: ViewportScroller,
        private readonly router: Router,
        private readonly seo: SeoService,
        private readonly snackbarService: SnackbarService,
        private readonly store: UserListDetailStore,
    ) {
        toObservable(this.listId)
            .pipe(
                distinctUntilChanged(),
                switchMap((listId) => this.store.loadList$(listId)),
                catchError(() => {
                    this.router.navigate(['not-found']);
                    return EMPTY;
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();

        this.userListDetail$
            .pipe(
                tap(({ header }) => {
                    if (header.state === 'success') {
                        this.seo.setPage({
                            title: `${header.data.name} | List`,
                            description: header.data.description || 'Your saved movies and TV series in one CineKeep list.',
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
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load list items.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onAddTitles(listId: number): void {
        this.dialog
            .open<UserListAddItemsDialogComponent, UserListAddItemsDialogData, true | undefined>(
                UserListAddItemsDialogComponent,
                {
                    autoFocus: false,
                    data: { listId },
                    maxWidth: '42rem',
                    panelClass: ['media-list-dialog-panel', 'user-list-add-items-dialog-panel'],
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                switchMap((changed) => (changed ? this.store.reload$() : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not refresh this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onEditDetails(header: UserListDetailHeader, defaultSortBy: UserListResponse.SortByEnum): void {
        this.dialog
            .open<UserListEditDialogComponent, UserListEditDialogData>(UserListEditDialogComponent, {
                ariaLabelledBy: 'edit-list-title',
                autoFocus: false,
                data: {
                    listId: header.id,
                    cover: header.cover,
                    name: header.name,
                    description: header.description,
                    sortBy: defaultSortBy,
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
                        result.name === header.name &&
                        result.description === (header.description ?? '') &&
                        result.sortBy === defaultSortBy &&
                        isSameUserListCover(result.cover, header.cover)
                    ) {
                        return EMPTY;
                    }

                    return this.store.updateList$(result).pipe(
                        tap(() => {
                            this.snackbarService.showSuccess('List details updated.');
                        }),
                    );
                }),
                catchError(() => this.snackbarService.showError$('Could not update this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onSortFieldChange(value: unknown, current: UserListSort): void {
        const field = this.sortFieldOptions.find((option) => option.value === value)?.value;

        if (!field || field === current.field) {
            return;
        }

        this.applySort(toUserListSortBy({ field, direction: current.direction }));
    }

    onSortDirectionToggle(current: UserListSort): void {
        this.applySort(toUserListSortBy({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }));
    }

    private applySort(sortBy: UserListResponse.SortByEnum): void {
        this.store
            .setSortBy$(sortBy)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update list sorting.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onClearList(): void {
        this.confirmationDialog
            .confirm$({
                title: 'Clear this list?',
                message: 'Every title will be removed, but the list itself will stay in place so you can reuse it.',
                confirmLabel: 'Clear list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.clearList$() : EMPTY)),
                tap(() => {
                    this.snackbarService.showSuccess('List cleared.');
                }),
                catchError(() => this.snackbarService.showError$('Could not clear this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onDeleteList(): void {
        this.confirmationDialog
            .confirm$({
                title: 'Delete this list?',
                message: 'This permanently removes the list and every item saved to it from your account.',
                confirmLabel: 'Delete list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.deleteList$() : EMPTY)),
                tap(() => {
                    this.router.navigate(this.backLink);
                    this.snackbarService.showSuccess('List deleted.');
                }),
                catchError(() => this.snackbarService.showError$('Could not delete this list.')),
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
                    this.snackbarService.showSuccess('Item removed from the list.');
                }),
                catchError(() => this.snackbarService.showError$('Could not remove this item.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    onStartComment(item: UserListDetailItem): void {
        this.editingCommentKey.set(item.key);
        this.commentDraft.set(item.comment);
        afterNextRender(() => this.commentInput()?.nativeElement.focus(), { injector: this.injector });
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
        if (this.commentPending()) {
            return;
        }

        const comment = this.commentDraft().trim();

        if (comment === item.comment) {
            this.onCancelComment();
            return;
        }

        this.commentPending.set(true);

        this.store
            .updateItemComment$(item, comment)
            .pipe(
                tap(() => {
                    this.onCancelComment();
                    this.snackbarService.showSuccess(comment ? 'Comment saved.' : 'Comment removed.');
                }),
                catchError(() => this.snackbarService.showError$('Could not save this comment. Your text is still here, try again.')),
                finalize(() => this.commentPending.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
