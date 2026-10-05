import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { SigninDialogStoreService, USERNAME_MAX_LENGTH } from './signin-dialog-store.service';

export interface SigninDialogData {
    readonly title?: string;
    readonly description?: string;
}

export type SigninDialogResult = 'signed-in' | undefined;

@Component({
    selector: 'app-signin-dialog',
    imports: [AsyncPipe, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
    templateUrl: './signin-dialog.component.html',
    styleUrl: './signin-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [SigninDialogStoreService],
})
export class SigninDialogComponent {
    readonly usernameMaxLength = USERNAME_MAX_LENGTH;
    readonly form = this.signinDialogStoreService.form;
    readonly signinDialog$ = this.signinDialogStoreService.signinDialog$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly matDialogRef: MatDialogRef<SigninDialogComponent, SigninDialogResult>,
        private readonly signinDialogStoreService: SigninDialogStoreService,
        @Inject(MAT_DIALOG_DATA) data: SigninDialogData | null,
    ) {
        this.signinDialogStoreService.initialize(data);
    }

    toggleMode(): void {
        this.signinDialogStoreService.toggleMode();
    }

    submit(): void {
        this.signinDialogStoreService
            .submit$()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((result) => this.matDialogRef.close(result));
    }

    cancel(): void {
        this.matDialogRef.close();
    }
}
