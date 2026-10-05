import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import { SigninDialogComponent, SigninDialogData, SigninDialogResult } from './signin-dialog.component';

@Injectable({ providedIn: 'root' })
export class SigninDialogService {
    constructor(private readonly dialog: MatDialog) {}

    open$(data: SigninDialogData = {}): Observable<SigninDialogResult> {
        return this.dialog
            .open<SigninDialogComponent, SigninDialogData, SigninDialogResult>(SigninDialogComponent, {
                data,
                autoFocus: 'first-tabbable',
                maxWidth: '32rem',
                width: '100%',
            })
            .afterClosed();
    }
}
