import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, defer, map, tap } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import type { RemoteData } from '../../types';
import { remoteSuccess } from '../../utils/remote-data';
import type { SigninDialogData } from './signin-dialog.component';

interface SigninForm {
    email: FormControl<string>;
    username: FormControl<string>;
    password: FormControl<string>;
}

interface SigninDialogState {
    readonly mode: 'signin' | 'register';
    readonly signinTitle: string;
    readonly description: string;
    readonly request: RemoteData<'signed-in'>;
    readonly showEmailRequired: boolean;
    readonly showEmailInvalid: boolean;
    readonly showUsernameRequired: boolean;
    readonly showPasswordRequired: boolean;
}

export const USERNAME_MAX_LENGTH = 50;

@Injectable()
export class SigninDialogStoreService extends ComponentStore<SigninDialogState> {
    readonly form: FormGroup<SigninForm>;
    readonly signinDialog$ = this.select((state) => {
        const isRegister = state.mode === 'register';
        const isPending = state.request.state === 'loading';

        return {
            title: isRegister ? 'Create your account' : state.signinTitle,
            description: state.description,
            isRegister,
            isPending,
            submitLabel: isRegister ? 'Create account' : 'Sign in',
            passwordAutocomplete: isRegister ? 'new-password' : 'current-password',
            errorMessage: state.request.state === 'failure' ? String(state.request.error) : null,
            showEmailRequired: state.showEmailRequired,
            showEmailInvalid: state.showEmailInvalid,
            showUsernameRequired: state.showUsernameRequired,
            showPasswordRequired: state.showPasswordRequired,
        };
    });

    constructor(
        private readonly authService: AuthService,
        formBuilder: NonNullableFormBuilder,
    ) {
        super({
            mode: 'signin',
            signinTitle: 'Sign in',
            description: 'Sign in to keep a watchlist, save favorites, rate titles, and build lists.',
            request: { state: 'notAsked' },
            showEmailRequired: true,
            showEmailInvalid: false,
            showUsernameRequired: false,
            showPasswordRequired: true,
        });
        this.form = formBuilder.group({
            email: formBuilder.control('', [Validators.required, Validators.email]),
            username: formBuilder.control({ value: '', disabled: true }, [
                Validators.required,
                Validators.maxLength(USERNAME_MAX_LENGTH),
            ]),
            password: formBuilder.control('', [Validators.required]),
        });
        this.form.events.pipe(takeUntilDestroyed()).subscribe(() => {
            this.patchState({
                showEmailRequired: this.form.controls.email.hasError('required'),
                showEmailInvalid: this.form.controls.email.hasError('email'),
                showUsernameRequired: this.form.controls.username.hasError('required'),
                showPasswordRequired: this.form.controls.password.hasError('required'),
            });
        });
    }

    initialize(data: SigninDialogData | null): void {
        this.patchState({
            signinTitle: data?.title ?? 'Sign in',
            description: data?.description ?? this.get().description,
        });
    }

    toggleMode(): void {
        const mode = this.get().mode === 'register' ? 'signin' : 'register';
        this.patchState(({ request }) => ({
            mode,
            request: request.state === 'loading' ? request : { state: 'notAsked' },
        }));

        if (mode === 'register') {
            this.form.controls.username.enable();
        } else {
            this.form.controls.username.disable();
        }
    }

    submit$(): Observable<'signed-in'> {
        return defer(() => {
            if (this.get().request.state === 'loading') {
                return EMPTY;
            }

            if (this.form.invalid) {
                this.form.markAllAsTouched();
                return EMPTY;
            }

            const { mode } = this.get();
            const { email, username, password } = this.form.getRawValue();
            const request$ =
                mode === 'register'
                    ? this.authService.register$({ email: email.trim(), username: username.trim(), password })
                    : this.authService.login$({ email: email.trim(), password });

            this.patchState({ request: { state: 'loading' } });

            return request$.pipe(
                map(() => 'signed-in' as const),
                tap((result) => this.patchState({ request: remoteSuccess(result) })),
                // Authentication errors stay in the dialog so the user can correct the form and retry.
                catchError((error: unknown) => {
                    let message = 'Something went wrong. Please try again.';

                    if (error instanceof HttpErrorResponse) {
                        const detail: unknown = error.error?.detail ?? error.error?.message;

                        if (error.status === 401 && mode === 'signin') {
                            message = 'That email and password do not match.';
                        } else if (error.status === 409) {
                            message = 'An account with that email or username already exists.';
                        } else if (error.status === 400 && typeof detail === 'string' && detail.trim()) {
                            message = detail.trim();
                        } else if (error.status === 0) {
                            message = 'Could not reach CineKeep. Check your connection and try again.';
                        } else {
                            message = mode === 'register' ? 'Could not create your account.' : 'Could not sign you in.';
                        }
                    }

                    this.patchState({ request: { state: 'failure', error: message } });
                    return EMPTY;
                }),
            );
        });
    }
}
