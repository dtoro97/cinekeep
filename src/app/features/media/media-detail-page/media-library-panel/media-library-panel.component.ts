import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';

import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { SigninDialogService, SnackbarService, UserSessionStoreService } from '../../../../shared';
import { MediaDetailActionsStoreService, MediaUserListSummary } from '../../media-detail-actions-store.service';
import { MediaDetails } from '../../media-store.service';
import { UserRatingComponent } from '../../user-rating/user-rating.component';
import {
    MediaListDialogComponent,
    MediaListDialogData,
    MediaListDialogResult,
} from './media-list-dialog/media-list-dialog.component';

@Component({
    selector: 'app-media-library-panel',
    imports: [AsyncPipe, MatButtonModule, RouterLink, UserRatingComponent],
    templateUrl: './media-library-panel.component.html',
    styleUrl: './media-library-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaLibraryPanelComponent {
    @Input({ required: true }) media!: MediaDetails;
    @Input() canRate = false;
    @Output() readonly rate = new EventEmitter<void>();

    readonly library$ = this.actionsStore.library$;

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
                  catchError(() => of<MediaUserListSummary[]>([])),
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
                          .afterClosed()
                          .pipe(map((result) => ({ result, customLists }))),
                  ),
                  switchMap(({ result, customLists }) => {
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

                      const selectedList =
                          result?.kind === 'select-list' ? customLists.find(({ id }) => id === result.listId) : null;

                      return selectedList
                          ? this.actionsStore.addToList$(selectedList).pipe(
                                tap(() =>
                                    this.snackbarService.showSuccess(`${title} has been added to your list.`, {
                                        label: 'Open list',
                                        routerLink: ['/me/lists', selectedList.id],
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
