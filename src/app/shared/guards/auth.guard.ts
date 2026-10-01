import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { map, take } from 'rxjs';

import { UserSessionStoreService } from '../services/user-session-store.service';

/** Waits for the browser session restore, then lets only signed-in users through. */
export const authenticatedGuard: CanActivateFn = () => {
    const userSessionStore = inject(UserSessionStoreService);
    const router = inject(Router);

    return userSessionStore.settledIsAuthenticated$.pipe(
        take(1),
        map((isAuthenticated) => (isAuthenticated ? true : router.createUrlTree(['/']))),
    );
};
