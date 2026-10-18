import { Injectable, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';

import {
    EpisodeRatingControllerService,
    FavoriteControllerService,
    RatingControllerService,
    UserListControllerService,
    WatchlistControllerService,
} from '../../../../api-cinekeep';
import { AuthService } from '../../../services/auth.service';
import { UserSessionStoreService } from '../../../services/user-session-store.service';
import type { RemoteData } from '../../../types';
import { remoteSuccess } from '../../../utils/remote-data';
import { ConfirmationDialogService } from '../../confirmation-dialog/confirmation-dialog.service';
import { SigninDialogService } from '../../signin-dialog/signin-dialog.service';

interface LibraryCounts {
    readonly watchlist: number;
    readonly favourites: number;
    readonly ratings: number;
    readonly lists: number;
}

interface HeaderAccountMenuState {
    readonly hasRendered: boolean;
    readonly operation: RemoteData<unknown>;
    readonly counts: RemoteData<LibraryCounts>;
}

// Only the totals are needed, so each request asks for a single item.
const COUNT_PAGE = { page: 0, size: 1 };

@Injectable()
export class HeaderAccountMenuStoreService extends ComponentStore<HeaderAccountMenuState> {
    readonly account$ = this.select(
        this.state$,
        this.userSessionStoreService.authSession$,
        ({ hasRendered, operation, counts }, { resolved, isAuthenticated, username, displayName }) => {
            const totals = counts.state === 'success' ? counts.data : null;

            return {
                // Hydration and session restore must both settle before the account menu replaces its placeholder.
                isReady: hasRendered && resolved,
                isAuthenticated,
                displayName,
                avatarName: username ?? displayName,
                isBusy: operation.state === 'loading',
                libraryItems: [
                    { label: 'Watchlist', route: '/me/watchlists', count: totals?.watchlist ?? null },
                    { label: 'Favourites', route: '/me/favorites', count: totals?.favourites ?? null },
                    { label: 'Ratings', route: '/me/ratings', count: totals?.ratings ?? null },
                    { label: 'Lists', route: '/me/lists', count: totals?.lists ?? null },
                    { label: 'Create list', route: '/me/lists/new', count: null },
                ],
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly authService: AuthService,
        private readonly episodeRatingControllerService: EpisodeRatingControllerService,
        private readonly favoriteControllerService: FavoriteControllerService,
        private readonly ratingControllerService: RatingControllerService,
        private readonly userListControllerService: UserListControllerService,
        private readonly watchlistControllerService: WatchlistControllerService,
        private readonly confirmationDialogService: ConfirmationDialogService,
        private readonly signinDialogService: SigninDialogService,
        private readonly router: Router,
        private readonly userSessionStoreService: UserSessionStoreService,
    ) {
        super({ hasRendered: false, operation: { state: 'notAsked' }, counts: { state: 'notAsked' } });
        afterNextRender(() => this.patchState({ hasRendered: true }));
    }

    // Fetched on every open, so the totals match what was just added or removed elsewhere.
    loadCounts$(): Observable<unknown> {
        return defer(() => {
            if (!this.userSessionStoreService.isAuthenticated()) {
                return EMPTY;
            }

            return forkJoin({
                watchlist: this.watchlistControllerService.getWatchlist(COUNT_PAGE),
                favourites: this.favoriteControllerService.getFavorites(COUNT_PAGE),
                titleRatings: this.ratingControllerService.getRatings(COUNT_PAGE),
                episodeRatings: this.episodeRatingControllerService.getEpisodeRatings(COUNT_PAGE),
                lists: this.userListControllerService.getLists(COUNT_PAGE),
            }).pipe(
                map(({ watchlist, favourites, titleRatings, episodeRatings, lists }) => ({
                    watchlist: watchlist.totalElements ?? 0,
                    favourites: favourites.totalElements ?? 0,
                    ratings: (titleRatings.totalElements ?? 0) + (episodeRatings.totalElements ?? 0),
                    lists: lists.totalElements ?? 0,
                })),
                tap((counts) => this.patchState({ counts: remoteSuccess(counts) })),
                // The counts only decorate the menu; without them the items show no totals.
                catchError(() => of(null)),
            );
        });
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
