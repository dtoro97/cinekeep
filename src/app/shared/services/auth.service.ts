import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

import { Observable, catchError, finalize, map, of, share, tap, throwError } from 'rxjs';

import { AuthControllerService, AuthResponse, LoginRequest, RegisterRequest } from '../../api-cinekeep';
import { toSessionUser } from '../mappers/user-account.mapper';
import { UserSessionStoreService } from './user-session-store.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private refreshInFlight$: Observable<string> | null = null;

    constructor(
        private readonly authController: AuthControllerService,
        private readonly userSessionStore: UserSessionStoreService,
        @Inject(PLATFORM_ID) private readonly platformId: object,
    ) {}

    login$(request: LoginRequest): Observable<unknown> {
        return this.authController
            .login({ loginRequest: request })
            .pipe(map((response) => this.applyAuthResponse(response)));
    }

    register$(request: RegisterRequest): Observable<unknown> {
        return this.authController
            .register({ registerRequest: request })
            .pipe(map((response) => this.applyAuthResponse(response)));
    }

    /**
     * Silently restores the session from the refresh cookie. Browser only: during server
     * rendering there is no cookie on the auth path, so the status stays `unknown`.
     */
    restoreSession$() {
        if (!isPlatformBrowser(this.platformId)) {
            return of(undefined);
        }

        return this.refreshAccessToken$().pipe(
            // Without a valid refresh cookie the visitor is simply signed out.
            catchError(() => of(undefined)),
        );
    }

    /**
     * Rotates the refresh cookie and returns a new access token. Concurrent callers share
     * one request, so a burst of 401s triggers a single refresh.
     */
    refreshAccessToken$(): Observable<string> {
        if (!this.refreshInFlight$) {
            this.refreshInFlight$ = this.authController.refresh().pipe(
                map((response) => this.applyAuthResponse(response)),
                catchError((error: unknown) => {
                    this.userSessionStore.clearSession();
                    return throwError(() => error);
                }),
                finalize(() => {
                    this.refreshInFlight$ = null;
                }),
                share(),
            );
        }

        return this.refreshInFlight$;
    }

    signOut$() {
        return this.authController.logout().pipe(
            // The local session is cleared even when the backend logout fails.
            catchError(() => of(undefined)),
            tap(() => this.userSessionStore.clearSession()),
        );
    }

    /** Stores the session and returns its access token. */
    private applyAuthResponse(response: AuthResponse): string {
        const accessToken = response.accessToken?.trim();

        if (!accessToken || !response.user) {
            throw new Error('The sign-in service returned an incomplete response.');
        }

        this.userSessionStore.setSession(accessToken, toSessionUser(response.user));
        return accessToken;
    }
}
