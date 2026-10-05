import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

import type { SnackbarData } from '../../services/snackbar.service';

@Component({
    selector: 'app-snackbar',
    imports: [RouterLink],
    templateUrl: './snackbar.component.html',
    styleUrl: './snackbar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SnackbarComponent {
    constructor(
        @Inject(MAT_SNACK_BAR_DATA) readonly data: SnackbarData,
        private readonly snackBarRef: MatSnackBarRef<SnackbarComponent>,
    ) {}

    dismiss(): void {
        this.snackBarRef.dismiss();
    }
}
