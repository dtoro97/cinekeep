import { Injectable, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    readonly hasResolvedSession: boolean;
    readonly isAuthenticated: boolean;
    readonly username: string | null;
    readonly displayName: string;
    readonly operation: RemoteData<unknown>;
}

@Injectable()
export class HeaderAccountMenuStoreService extends ComponentStore<HeaderAccountMenuState> {
    readonly account$ = this.select((state) => ({
        isReady: state.hasRendered && state.hasResolvedSession,
        isAuthenticated: state.isAuthenticated,
        displayName: state.displayName,
        avatarName: state.username ?? state.displayName,
        isBusy: state.operation.state === 'loading',
    }));

    constructor(
        private readonly authService: AuthService,
        private readonly confirmationDialogService: ConfirmationDialogService,
        private readonly signinDialogService: SigninDialogService,
        private readonly router: Router,
        userSessionStoreService: UserSessionStoreService,
    ) {
        super({
            hasRendered: false,
            hasResolvedSession: false,
            isAuthenticated: false,
            username: null,
            displayName: 'Member',
            operation: { state: 'notAsked' },
        });
        userSessionStoreService.authSession$.pipe(takeUntilDestroyed()).subscribe((auth) =>
            this.patchState({
                hasResolvedSession: auth.resolved,
                isAuthenticated: auth.isAuthenticated,
                username: auth.username,
                displayName: auth.displayName,
            }),
        );
        // Hydration and session restore must both settle before the account menu replaces its placeholder.
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
