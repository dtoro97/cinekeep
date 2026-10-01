import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, filter, map, of } from 'rxjs';

import { SessionUser, UserSessionState } from '../models';

const INITIAL_SESSION_STATE: UserSessionState = {
    status: 'unknown',
    accessToken: null,
    user: null,
};

/**
 * Holds the CineKeep session. The access token lives in memory only; after a reload
 * it is restored from the httpOnly refresh cookie by `AuthService.restoreSession$`.
 */
@Injectable({ providedIn: 'root' })
export class UserSessionStoreService extends ComponentStore<UserSessionState> {
    readonly user$ = this.select((state) => state.user);
    readonly authViewModel$ = this.select((state) => {
        const username = state.user?.username ?? null;

        return {
            resolved: state.status !== 'unknown',
            isAuthenticated: state.status === 'authenticated',
            username,
            displayName: username ?? 'Member',
        };
    });

    /**
     * Emits once the browser session restore has settled, then on every sign-in and sign-out.
     * On the server it emits `false` once, so server-rendered data uses the anonymous view.
     */
    readonly settledIsAuthenticated$: Observable<boolean>;

    constructor(@Inject(PLATFORM_ID) platformId: object) {
        super(INITIAL_SESSION_STATE);

        this.settledIsAuthenticated$ = isPlatformBrowser(platformId)
            ? this.select((state) => state.status).pipe(
                  filter((status) => status !== 'unknown'),
                  map((status) => status === 'authenticated'),
              )
            : of(false);
    }

    isAuthenticated(): boolean {
        return this.get().status === 'authenticated';
    }

    accessToken(): string | null {
        return this.get().accessToken;
    }

    setSession(accessToken: string, user: SessionUser): void {
        this.setState({ status: 'authenticated', accessToken, user });
    }

    clearSession(): void {
        this.setState({ status: 'anonymous', accessToken: null, user: null });
    }
}
