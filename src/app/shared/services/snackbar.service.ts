import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { EMPTY, Observable } from 'rxjs';

import type { RouteCommands } from '../types';
import { SnackbarComponent } from '../ui/snackbar/snackbar.component';

export interface SnackbarLink {
    readonly label: string;
    readonly routerLink: string | RouteCommands;
}

export interface SnackbarData {
    readonly message: string;
    readonly link?: SnackbarLink;
}

const DURATION_MS = 5000;
// A snackbar with a link stays longer, so there is time to follow it.
const LINK_DURATION_MS = 7000;

@Injectable({ providedIn: 'root' })
export class SnackbarService {
    constructor(private readonly matSnackBar: MatSnackBar) {}

    showSuccess(message: string, link?: SnackbarLink): void {
        this.matSnackBar.openFromComponent<SnackbarComponent, SnackbarData>(SnackbarComponent, {
            data: { message, link },
            duration: link ? LINK_DURATION_MS : DURATION_MS,
            panelClass: 'snackbar-success',
        });
    }

    /** Shows the error right away and returns `EMPTY`, so `catchError` can report and end a failed action. */
    showError$(message: string): Observable<never> {
        this.matSnackBar.openFromComponent<SnackbarComponent, SnackbarData>(SnackbarComponent, {
            data: { message },
            duration: DURATION_MS,
            panelClass: 'snackbar-error',
        });

        return EMPTY;
    }
}
