import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { EMPTY, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { IconButtonComponent, SigninDialogService, SnackbarService, UserSessionStoreService } from '../../../../shared';
import { MediaDetailActionsStoreService } from '../../media-detail-actions-store.service';
import { MediaDetails } from '../../media-store.service';
import {
    MediaListDialogComponent,
    MediaListDialogData,
    MediaListDialogResult,
} from './media-list-dialog/media-list-dialog.component';

@Component({
    selector: 'app-media-list-actions',
    imports: [AsyncPipe, IconButtonComponent, MatButtonModule, MatTooltipModule],
    templateUrl: './media-list-actions.component.html',
    styleUrl: './media-list-actions.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListActionsComponent {
    @Input({ required: true }) media!: MediaDetails;

    readonly listActions$ = this.actionsStore.listActions$;

    constructor(
        private readonly actionsStore: MediaDetailActionsStoreService,
        private readonly destroyRef: DestroyRef,
        private readonly matDialog: MatDialog,
        private readonly router: Router,
        private readonly signinDialogService: SigninDialogService,
        private readonly snackbarService: SnackbarService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {}

    toggleWatchlist(): void {
        (this.userSessionStore.isAuthenticated()
            ? this.actionsStore.toggleLibraryFlag$('watchlist')
            : this.signinDialogService.open$()
        )
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    toggleFavorite(): void {
        (this.userSessionStore.isAuthenticated()
            ? this.actionsStore.toggleLibraryFlag$('favorite')
            : this.signinDialogService.open$()
        )
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your favorites.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    openListsDialog(): void {
        const { id, title, mediaType, backdropPath } = this.media;

        this.actionsStore.setListDialogPending(true);

        (this.userSessionStore.isAuthenticated()
            ? this.actionsStore.getUserLists$().pipe(
                  // Without the user's lists the dialog still offers to create a new one.
                  catchError(() => of([])),
                  switchMap((customLists) =>
                      this.matDialog
                          .open<MediaListDialogComponent, MediaListDialogData, MediaListDialogResult>(
                              MediaListDialogComponent,
                              {
                                  data: { title, customLists },
                                  autoFocus: false,
                                  maxWidth: '32rem',
                                  panelClass: 'media-list-dialog-panel',
                                  width: '100%',
                              },
                          )
                          .afterClosed(),
                  ),
                  switchMap((result) => {
                      if (result?.kind === 'create-list') {
                          this.router.navigate(['/me/lists/new'], {
                              queryParams: {
                                  mediaId: id,
                                  mediaType,
                                  mediaTitle: result.mediaTitle,
                                  // Lets the new-list page use the title as the list cover.
                                  mediaBackdrop: backdropPath,
                                  returnUrl: this.router.url,
                              },
                          });
                      }

                      return result?.kind === 'select-list'
                          ? this.actionsStore.addToList$(result.listId).pipe(
                                tap(() =>
                                    this.snackbarService.showSuccess(`${title} has been added to your list.`, {
                                        label: 'Open list',
                                        routerLink: ['/me/lists', result.listId],
                                    }),
                                ),
                            )
                          : EMPTY;
                  }),
              )
            : this.signinDialogService.open$()
        )
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your list.')),
                finalize(() => this.actionsStore.setListDialogPending(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
