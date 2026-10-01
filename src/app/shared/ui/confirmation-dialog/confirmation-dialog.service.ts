import { Injectable } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { Observable, map } from 'rxjs';

import {
    ConfirmationDialogComponent,
    ConfirmationDialogData,
    ConfirmationDialogResult,
} from './confirmation-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmationDialogService {
    constructor(private readonly dialog: MatDialog) {}

    confirm$(data: ConfirmationDialogData): Observable<boolean> {
        return this.dialog
            .open<
                ConfirmationDialogComponent,
                ConfirmationDialogData,
                ConfirmationDialogResult
            >(ConfirmationDialogComponent, {
                autoFocus: false,
                data,
                maxWidth: '30rem',
                width: '100%',
            })
            .afterClosed()
            .pipe(
                map((result) => result === true),
            );
    }
}
