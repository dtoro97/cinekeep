import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EMPTY, Observable, switchMap } from 'rxjs';

import { UserSessionStoreService } from '../../services/user-session-store.service';
import { SigninDialogService } from '../signin-dialog/signin-dialog.service';
import {
    MediaRatingDialogComponent,
    MediaRatingDialogData,
    MediaRatingDialogResult,
} from './media-rating-dialog.component';

export interface MediaRatingDialogRequest {
    readonly title: string;
    readonly currentRating: number | null;
    readonly save: (value: number) => Observable<unknown>;
    readonly remove: () => Observable<unknown>;
}

@Injectable({ providedIn: 'root' })
export class MediaRatingDialogService {
    constructor(
        private readonly dialog: MatDialog,
        private readonly signinDialog: SigninDialogService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {}

    /** Opens the rating dialog and runs the chosen action; choosing to sign in opens the sign-in dialog. */
    open$({ title, currentRating, save, remove }: MediaRatingDialogRequest): Observable<unknown> {
        return this.dialog
            .open<MediaRatingDialogComponent, MediaRatingDialogData, MediaRatingDialogResult>(
                MediaRatingDialogComponent,
                {
                    data: {
                        title,
                        currentRating,
                        isAuthenticated: this.userSessionStore.isAuthenticated(),
                    },
                    maxWidth: '36rem',
                    width: '100%',
                },
            )
            .afterClosed()
            .pipe(
                switchMap((result) => {
                    switch (result?.action) {
                        case 'save':
                            return save(result.value);
                        case 'remove':
                            return remove();
                        case 'login':
                            return this.signinDialog.open$();
                        default:
                            return EMPTY;
                    }
                }),
            );
    }
}
