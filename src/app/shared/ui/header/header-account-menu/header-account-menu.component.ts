import { AsyncPipe } from '@angular/common';
import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import {
    BehaviorSubject,
    EMPTY,
    catchError,
    combineLatest,
    finalize,
    map,
    switchMap,
    tap,
} from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { UserSessionStoreService } from '../../../services/user-session-store.service';
import { ConfirmationDialogService } from '../../confirmation-dialog/confirmation-dialog.service';
import { SigninDialogService } from '../../signin-dialog/signin-dialog.service';
import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';

interface HeaderAccountRoute {
    readonly label: string;
    readonly route: string;
    readonly icon: string;
}

interface HeaderAccountMenuViewModel {
    readonly ready: boolean;
    readonly isAuthenticated: boolean;
    readonly username: string | null;
    readonly displayName: string;
    readonly busy: boolean;
}

@Component({
    selector: 'app-header-account-menu',
    imports: [
        AsyncPipe,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        RouterLink,
        UserAvatarComponent,
    ],
    templateUrl: './header-account-menu.component.html',
    styleUrl: './header-account-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderAccountMenuComponent {
    readonly accountRoutes: readonly HeaderAccountRoute[] = [
        { label: 'Profile', route: '/me', icon: 'person' },
        { label: 'Watchlist', route: '/me/watchlists', icon: 'bookmark' },
        { label: 'Favorites', route: '/me/favorites', icon: 'favorite' },
        { label: 'Ratings', route: '/me/ratings', icon: 'star' },
        { label: 'Lists', route: '/me/lists', icon: 'format_list_bulleted' },
        { label: 'Create list', route: '/me/lists/new', icon: 'add' },
    ];

    private readonly busy$ = new BehaviorSubject(false);
    private readonly ready$ = new BehaviorSubject(false);

    readonly vm$ = combineLatest([
        this.ready$,
        this.userSessionStore.authViewModel$,
        this.busy$,
    ]).pipe(
        map(
            ([ready, auth, busy]): HeaderAccountMenuViewModel => ({
                // Stays a placeholder until hydration and the session restore have both settled.
                ready: ready && auth.resolved,
                isAuthenticated: auth.isAuthenticated,
                username: auth.username,
                displayName: auth.displayName,
                busy,
            }),
        ),
    );

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly confirmationDialog: ConfirmationDialogService,
        private readonly signinDialog: SigninDialogService,
        private readonly authService: AuthService,
        private readonly userSessionStore: UserSessionStoreService,
        private readonly router: Router,
    ) {
        afterNextRender(() => {
            this.ready$.next(true);
        });
    }

    startLogin(): void {
        if (this.busy$.value) {
            return;
        }

        this.busy$.next(true);

        this.signinDialog
            .open$()
            .pipe(
                catchError(() => EMPTY),
                finalize(() => this.busy$.next(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    signOut(): void {
        if (this.busy$.value) {
            return;
        }

        this.confirmationDialog
            .confirm$({
                title: 'Sign out?',
                message:
                    'You will need to sign in again to manage your watchlist, favorites, ratings, and lists.',
                confirmLabel: 'Sign out',
                tone: 'danger',
            })
            .pipe(
                switchMap((confirmed) => {
                    if (!confirmed) {
                        return EMPTY;
                    }

                    this.busy$.next(true);

                    return this.authService.signOut$().pipe(
                        tap(() => {
                            // Session state updates the UI on its own; only leave account-only pages.
                            if (this.isOnAccountPage()) {
                                void this.router.navigateByUrl('/');
                            }
                        }),
                        catchError(() => EMPTY),
                        finalize(() => this.busy$.next(false)),
                    );
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private isOnAccountPage(): boolean {
        const segments = this.router.parseUrl(this.router.url).root.children['primary']?.segments;

        return segments?.[0]?.path === 'me';
    }
}
