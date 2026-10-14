import { Injectable, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, defer, switchMap, tap } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { UserSessionStoreService } from '../../../services/user-session-store.service';
import type { RemoteData } from '../../../types';
import { remoteSuccess } from '../../../utils/remote-data';
import { ConfirmationDialogService } from '../../confirmation-dialog/confirmation-dialog.service';
import { SigninDialogService } from '../../signin-dialog/signin-dialog.service';

interface HeaderAccountMenuState {
    readonly hasRendered: boolean;
    readonly operation: RemoteData<unknown>;
}

@Injectable()
export class HeaderAccountMenuStoreService extends ComponentStore<HeaderAccountMenuState> {
    readonly account$ = this.select(
        this.state$,
        this.userSessionStoreService.authSession$,
        ({ hasRendered, operation }, { resolved, isAuthenticated, username, displayName }) => ({
            // Hydration and session restore must both settle before the account menu replaces its placeholder.
            isReady: hasRendered && resolved,
            isAuthenticated,
            displayName,
            avatarName: username ?? displayName,
            isBusy: operation.state === 'loading',
        }),
        { debounce: true },
    );

    constructor(
        private readonly authService: AuthService,
        private readonly confirmationDialogService: ConfirmationDialogService,
        private readonly signinDialogService: SigninDialogService,
        private readonly router: Router,
        private readonly userSessionStoreService: UserSessionStoreService,
    ) {
        super({ hasRendered: false, operation: { state: 'notAsked' } });
        afterNextRender(() => this.patchState({ hasRendered: true }));
    }

    startLogin$(): Observable<unknown> {
        return defer(() => {
            if (this.get().operation.state === 'loading') {
                return EMPTY;
            }

            this.patchState({ operation: { state: 'loading' } });

            return this.signinDialogService.open$().pipe(
                tap((result) => this.patchState({ operation: remoteSuccess(result) })),
                // The dialog reports sign-in errors and the account menu remains usable.
                catchError((error: unknown) => {
                    this.patchState({ operation: { state: 'failure', error } });
                    return EMPTY;
                }),
            );
        });
    }

    signOut$(): Observable<unknown> {
        return defer(() => {
            if (this.get().operation.state === 'loading') {
                return EMPTY;
            }

            return this.confirmationDialogService
                .confirm$({
                    title: 'Sign out?',
                    message: 'You will need to sign in again to manage your watchlist, favorites, ratings, and lists.',
                    confirmLabel: 'Sign out',
                    tone: 'danger',
                })
                .pipe(
                    switchMap((isConfirmed) => {
                        if (!isConfirmed) {
                            return EMPTY;
                        }

                        this.patchState({ operation: { state: 'loading' } });

                        return this.authService.signOut$().pipe(
                            tap((result) => {
                                this.patchState({ operation: remoteSuccess(result) });
                                const segments = this.router.parseUrl(this.router.url).root.children['primary']
                                    ?.segments;

                                if (segments?.[0]?.path === 'me') {
                                    this.router.navigateByUrl('/');
                                }
                            }),
                            // Keep the current session visible when sign-out fails.
                            catchError((error: unknown) => {
                                this.patchState({ operation: { state: 'failure', error } });
                                return EMPTY;
                            }),
                        );
                    }),
                );
        });
    }
}
