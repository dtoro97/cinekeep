import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { UserSessionStoreService } from '../services/user-session-store.service';
import { environment } from '../../../environments/environment';

// The base URL is empty in production, where the Vercel rewrite keeps the backend same-origin.
const API_PREFIX = `${environment.backendApiUrl}/api/`;
const AUTH_PREFIX = `${environment.backendApiUrl}/api/auth/`;

/** CineKeep API requests carry user data, so they are also kept out of the SSR transfer cache. */
export const isBackendApiRequest = (url: string): boolean => url.startsWith(API_PREFIX);

/**
 * Adds the CineKeep access token to CineKeep API requests only. TMDb requests carry their
 * own read token and must never receive the user's JWT.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!isBackendApiRequest(req.url)) {
        return next(req);
    }

    const userSessionStore = inject(UserSessionStoreService);

    if (req.url.startsWith(AUTH_PREFIX)) {
        return next(req);
    }

    const accessToken = userSessionStore.accessToken();

    if (!accessToken) {
        return next(req);
    }

    const authService = inject(AuthService);

    return next(withBearer(req, accessToken)).pipe(
        catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
                return throwError(() => error);
            }

            return authService
                .refreshAccessToken$()
                .pipe(switchMap((refreshedToken) => next(withBearer(req, refreshedToken))));
        }),
    );
};

function withBearer(req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
    return req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}
