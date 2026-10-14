import { AsyncPipe, ViewportScroller } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    Injector,
    ViewChild,
    afterNextRender,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EMPTY, catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    ConfirmationDialogService,
    EmptyStateComponent,
    IconButtonComponent,
    MediaListItemComponent,
    RepeatPipe,
    SeoService,
    SnackbarService,
    SortButtonComponent,
    SubPageHeaderComponent,
} from '../../../shared';
import { UserListEditDialogComponent } from '../user-list-edit-dialog/user-list-edit-dialog.component';
import {
    UserListEditDialogData,
    UserListEditDialogResult,
} from '../user-list-edit-dialog/user-list-edit-dialog-store.service';
import { USER_LIST_SORT_FIELD_OPTIONS, UserListSortField } from '../user-list-sort-options';
import {
    UserListAddItemsDialogComponent,
    UserListAddItemsDialogData,
} from './user-list-add-items-dialog/user-list-add-items-dialog.component';
import {
    UserListDetailHeader,
    UserListDetailItem,
    UserListDetailPageStoreService,
} from './user-list-detail-page-store.service';

@Component({
    selector: 'app-user-list-detail-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        IconButtonComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatPaginatorModule,
        MatTooltipModule,
        MediaListItemComponent,
        RepeatPipe,
        SortButtonComponent,
        SubPageHeaderComponent,
    ],
    providers: [UserListDetailPageStoreService],
    templateUrl: './user-list-detail-page.component.html',
    styleUrl: './user-list-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListDetailPageComponent {
    readonly backLink = ['/', 'me', 'lists'];
    readonly skeletonCount = 6;
    readonly sortFieldOptions = USER_LIST_SORT_FIELD_OPTIONS;
    readonly userListDetail$ = this.store.userListDetail$;

    @ViewChild('commentInput') private commentInput?: ElementRef<HTMLTextAreaElement>;

    constructor(
        private readonly store: UserListDetailPageStoreService,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly matDialog: MatDialog,
        private readonly router: Router,
        private readonly snackbarService: SnackbarService,
        private readonly viewportScroller: ViewportScroller,
        private readonly injector: Injector,
        private readonly destroyRef: DestroyRef,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        activatedRoute.paramMap
            .pipe(
                map((paramMap) => Number(paramMap.get('listId'))),
                distinctUntilChanged(),
                switchMap((listId) =>
                    this.store.load$(listId).pipe(
                        catchError(() => {
                            this.router.navigate(['not-found']);
                            return EMPTY;
                        }),
                    ),
                ),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);

        this.store
            .loadPage$(event.pageIndex)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load list items.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    setSortField(field: UserListSortField): void {
        this.store
            .setSortField$(field)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update list sorting.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    toggleSortDirection(): void {
        this.store
            .toggleSortDirection$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update list sorting.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    addTitles(header: UserListDetailHeader): void {
        this.matDialog
            .open<UserListAddItemsDialogComponent, UserListAddItemsDialogData, true | undefined>(
                UserListAddItemsDialogComponent,
                {
                    autoFocus: false,
                    data: { listId: header.id },
                    maxWidth: '42rem',
                    panelClass: ['media-list-dialog-panel', 'user-list-add-items-dialog-panel'],
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                switchMap((hasChanges) => (hasChanges ? this.store.reload$() : EMPTY)),
                catchError(() => this.snackbarService.showError$('Could not refresh this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    editList(header: UserListDetailHeader): void {
        this.matDialog
            .open<UserListEditDialogComponent, UserListEditDialogData, UserListEditDialogResult>(
                UserListEditDialogComponent,
                {
                    ariaLabelledBy: 'edit-list-title',
                    autoFocus: false,
                    data: {
                        listId: header.id,
                        cover: header.cover,
                        name: header.name,
                        description: header.description,
                        sortBy: header.sortBy,
                    },
                    maxWidth: '40rem',
                    panelClass: 'media-list-dialog-panel',
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                switchMap((changes) => (changes ? this.store.updateList$(changes) : EMPTY)),
                tap(() => this.snackbarService.showSuccess('List details updated.')),
                catchError(() => this.snackbarService.showError$('Could not update this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    clearList(): void {
        this.confirmationDialog
            .confirm$({
                title: 'Clear this list?',
                message: 'Every title will be removed, but the list itself will stay in place so you can reuse it.',
                confirmLabel: 'Clear list',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.clearList$() : EMPTY)),
                tap(() => this.snackbarService.showSuccess('List cleared.')),
                catchError(() => this.snackbarService.showError$('Could not clear this list.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    deleteList(): void {
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

    removeItem(item: UserListDetailItem): void {
        this.confirmationDialog
            .confirm$({
                title: `Remove ${item.mediaItem.title}?`,
                message: 'This removes the title from this list only.',
                confirmLabel: 'Remove item',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => (confirmed ? this.store.removeItem$(item) : EMPTY)),
                tap(() => this.snackbarService.showSuccess('Item removed from the list.')),
                catchError(() => this.snackbarService.showError$('Could not remove this item.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    startComment(item: UserListDetailItem): void {
        this.store.startComment(item);
        afterNextRender(() => this.commentInput?.nativeElement.focus(), { injector: this.injector });
    }

    updateCommentDraft(draft: string): void {
        this.store.updateCommentDraft(draft);
    }

    cancelComment(): void {
        this.store.cancelComment();
    }

    saveComment(item: UserListDetailItem): void {
        this.store
            .saveComment$(item)
            .pipe(
                tap((comment) => this.snackbarService.showSuccess(comment ? 'Comment saved.' : 'Comment removed.')),
                catchError(() =>
                    this.snackbarService.showError$('Could not save this comment. Your text is still here, try again.'),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
