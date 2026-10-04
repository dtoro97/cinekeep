import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { EMPTY, catchError, finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';

export interface SigninDialogData {
    readonly title?: string;
    readonly description?: string;
}

export type SigninDialogResult = 'signed-in' | undefined;

type SigninDialogMode = 'signin' | 'register';

interface SigninForm {
    email: FormControl<string>;
    username: FormControl<string>;
    password: FormControl<string>;
}

const USERNAME_MAX_LENGTH = 50;

function toAuthErrorMessage(error: unknown, mode: SigninDialogMode): string {
    if (!(error instanceof HttpErrorResponse)) {
        return 'Something went wrong. Please try again.';
    }

    if (error.status === 401 && mode === 'signin') {
        return 'That email and password do not match.';
    }

    if (error.status === 409) {
        return 'An account with that email or username already exists.';
    }

    const detail: unknown = error.error?.detail ?? error.error?.message;

    if (error.status === 400 && typeof detail === 'string' && detail.trim()) {
        return detail.trim();
    }

    if (error.status === 0) {
        return 'Could not reach CineKeep. Check your connection and try again.';
    }

    return mode === 'register' ? 'Could not create your account.' : 'Could not sign you in.';
}

@Component({
    selector: 'app-signin-dialog',
    imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
    templateUrl: './signin-dialog.component.html',
    styleUrl: './signin-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SigninDialogComponent {
    readonly usernameMaxLength = USERNAME_MAX_LENGTH;
    readonly mode = signal<SigninDialogMode>('signin');
    readonly pending = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly isRegister = computed(() => this.mode() === 'register');
    readonly title = computed(() => (this.isRegister() ? 'Create your account' : this.signinTitle));
    readonly submitLabel = computed(() => (this.isRegister() ? 'Create account' : 'Sign in'));
    readonly passwordAutocomplete = computed(() => (this.isRegister() ? 'new-password' : 'current-password'));
    readonly description: string;

    readonly form: FormGroup<SigninForm>;

    private readonly signinTitle: string;

    constructor(
        private readonly authService: AuthService,
        private readonly destroyRef: DestroyRef,
        private readonly dialogRef: MatDialogRef<SigninDialogComponent, SigninDialogResult>,
        formBuilder: NonNullableFormBuilder,
        @Inject(MAT_DIALOG_DATA) data: SigninDialogData | null,
    ) {
        this.signinTitle = data?.title ?? 'Sign in';
        this.description =
            data?.description ?? 'Sign in to keep a watchlist, save favorites, rate titles, and build lists.';
        this.form = formBuilder.group({
            email: formBuilder.control('', [Validators.required, Validators.email]),
            username: formBuilder.control({ value: '', disabled: true }, [
                Validators.required,
                Validators.maxLength(USERNAME_MAX_LENGTH),
            ]),
            password: formBuilder.control('', [Validators.required]),
        });
    }

    toggleMode(): void {
        const nextMode: SigninDialogMode = this.isRegister() ? 'signin' : 'register';

        this.mode.set(nextMode);
        this.errorMessage.set(null);

        if (nextMode === 'register') {
            this.form.controls.username.enable();
        } else {
            this.form.controls.username.disable();
        }
    }

    submit(): void {
        if (this.pending()) {
            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const mode = this.mode();
        const { email, username, password } = this.form.getRawValue();
        const request$ =
            mode === 'register'
                ? this.authService.register$({ email: email.trim(), username: username.trim(), password })
                : this.authService.login$({ email: email.trim(), password });

        this.pending.set(true);
        this.errorMessage.set(null);

        request$
            .pipe(
                catchError((error: unknown) => {
                    this.errorMessage.set(toAuthErrorMessage(error, mode));
                    return EMPTY;
                }),
                finalize(() => this.pending.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe(() => this.dialogRef.close('signed-in'));
    }

    cancel(): void {
        this.dialogRef.close(undefined);
    }
}
