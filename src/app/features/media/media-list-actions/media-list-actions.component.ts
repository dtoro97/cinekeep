import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EMPTY, catchError, finalize, of, switchMap, tap } from 'rxjs';

import {
    IconButtonComponent,
    MediaType,
    SnackbarService,
    SigninDialogService,
    UserSessionStoreService,
} from '../../../shared';
import { MediaDetailActionsStore, MediaUserListSummary } from '../media-detail-actions-store.service';
import {
    MediaListDialogComponent,
    MediaListDialogData,
    MediaListDialogResult,
} from '../media-list-dialog/media-list-dialog.component';

@Component({
    selector: 'app-media-list-actions',
    imports: [AsyncPipe, MatButtonModule, MatTooltipModule, IconButtonComponent],
    templateUrl: './media-list-actions.component.html',
    styleUrl: './media-list-actions.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListActionsComponent {
    @Input({ required: true }) mediaId!: number;
    @Input({ required: true }) title!: string;
    @Input({ required: true }) mediaType!: MediaType;
    /** Carried to the new-list page so its preview can use the title as the list cover. */
    @Input() backdropPath: string | null = null;

    readonly listActions$ = this.mediaDetailActionsStore.listActions$;
    readonly listDialogPending = signal(false);

    constructor(
        private readonly dialog: MatDialog,
        private readonly mediaDetailActionsStore: MediaDetailActionsStore,
        private readonly router: Router,
        private readonly snackbarService: SnackbarService,
        private readonly signinDialog: SigninDialogService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {}

    toggleWatchlist() {
        const action$ = this.userSessionStore.isAuthenticated()
            ? this.mediaDetailActionsStore.toggleLibraryFlag$('watchlist')
            : this.openSigninDialog();

        action$
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your watchlist.')),
            )
            .subscribe();
    }

    toggleFavorite() {
        const action$ = this.userSessionStore.isAuthenticated()
            ? this.mediaDetailActionsStore.toggleLibraryFlag$('favorite')
            : this.openSigninDialog();

        action$
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your favorites.')),
            )
            .subscribe();
    }

    openCustomListsDialog() {
        if (this.listDialogPending()) {
            return;
        }

        this.listDialogPending.set(true);

        if (!this.userSessionStore.isAuthenticated()) {
            this.openSigninDialog()
                .pipe(
                    catchError(() => this.snackbarService.showError$('Could not update your list.')),
                    finalize(() => this.listDialogPending.set(false)),
                )
                .subscribe();
            return;
        }

        this.mediaDetailActionsStore
            .getUserLists$()
            .pipe(
                catchError(() => of([] as MediaUserListSummary[])),
                switchMap((lists) => this.openListsDialog(lists)),
                catchError(() => this.snackbarService.showError$('Could not update your list.')),
                finalize(() => this.listDialogPending.set(false)),
            )
            .subscribe();
    }

    private openListsDialog(customLists: MediaUserListSummary[]) {
        return this.dialog
            .open<MediaListDialogComponent, MediaListDialogData, MediaListDialogResult>(MediaListDialogComponent, {
                data: { title: this.title, customLists },
                autoFocus: false,
                maxWidth: '32rem',
                panelClass: 'media-list-dialog-panel',
                width: '100%',
            })
            .afterClosed()
            .pipe(
                switchMap((result) => this.handleListsDialogResult(result)),
            );
    }

    private openSigninDialog() {
        return this.signinDialog.open$();
    }

    private handleListsDialogResult(result: MediaListDialogResult | undefined) {
        if (result === undefined) {
            return EMPTY;
        }

        if (result.kind === 'create-list') {
            this.router.navigate(['/me/lists/new'], {
                queryParams: {
                    mediaId: this.mediaId,
                    mediaType: this.mediaType,
                    mediaTitle: result.mediaTitle,
                    mediaBackdrop: this.backdropPath,
                    returnUrl: this.router.url,
                },
            });
            return EMPTY;
        }

        return this.mediaDetailActionsStore.addToList$(result.listId).pipe(
            tap(() => {
                this.snackbarService.showSuccess(`${this.title} has been added to your list.`, {
                    label: 'Open list',
                    routerLink: ['/me/lists', result.listId],
                });
            }),
        );
    }
}
