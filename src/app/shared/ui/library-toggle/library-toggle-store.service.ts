import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    combineLatest,
    defer,
    distinctUntilChanged,
    filter,
    startWith,
    switchMap,
    takeUntil,
    tap,
} from 'rxjs';

import type { MediaStateResponse } from '../../../api-cinekeep';
import { SnackbarService } from '../../services/snackbar.service';
import { UserLibraryService } from '../../services/user-library.service';
import { UserSessionStoreService } from '../../services/user-session-store.service';
import type { LibraryFlag, MediaType, RemoteData } from '../../types';
import { isDefined } from '../../utils/is-defined';
import { mapRemoteData } from '../../utils/remote-data';
import { SigninDialogService } from '../signin-dialog/signin-dialog.service';

export interface LibraryToggleMedia {
    readonly id: number;
    readonly mediaType: MediaType;
    readonly title: string;
}

export interface LibraryToggleContext {
    readonly media: LibraryToggleMedia;
    readonly flag: LibraryFlag;
    readonly libraryState: RemoteData<MediaStateResponse> | null;
}

interface LibraryToggleState {
    readonly context: LibraryToggleContext | null;
    readonly savedFlag: RemoteData<boolean>;
    readonly mutation: RemoteData<boolean>;
}

const LIBRARY_TOGGLE_COPY = {
    watchlist: {
        iconClass: 'fa-bookmark',
        activeLabel: 'On watchlist',
        inactiveLabel: 'Add to watchlist',
        activeAriaLabel: (title: string) => `${title} is on your watchlist`,
        inactiveAriaLabel: (title: string) => `Add ${title} to watchlist`,
        errorMessage: 'Could not update your watchlist.',
    },
    favorite: {
        iconClass: 'fa-heart',
        activeLabel: 'In favorites',
        inactiveLabel: 'Add to favorites',
        activeAriaLabel: (title: string) => `${title} is in your favorites`,
        inactiveAriaLabel: (title: string) => `Add ${title} to favorites`,
        errorMessage: 'Could not update your favorites.',
    },
};

@Injectable()
export class LibraryToggleStoreService extends ComponentStore<LibraryToggleState> {
    readonly libraryToggle$ = this.select(({ context, savedFlag, mutation }) => {
        const copy = LIBRARY_TOGGLE_COPY[context?.flag ?? 'watchlist'];
        const isActive = mutation.state === 'success' ? mutation.data : savedFlag.state === 'success' && savedFlag.data;
        const title = context?.media.title ?? '';

        return {
            isActive,
            isDisabled: savedFlag.state === 'loading' || mutation.state === 'loading',
            iconClass: copy.iconClass,
            label: isActive ? copy.activeLabel : copy.inactiveLabel,
            ariaLabel: isActive ? copy.activeAriaLabel(title) : copy.inactiveAriaLabel(title),
        };
    });

    constructor(
        private readonly snackbarService: SnackbarService,
        private readonly userLibraryService: UserLibraryService,
        private readonly userSessionStoreService: UserSessionStoreService,
        private readonly signinDialogService: SigninDialogService,
    ) {
        super({ context: null, savedFlag: { state: 'notAsked' }, mutation: { state: 'notAsked' } });
        this.loadFlag(this.select((state) => state.context).pipe(filter(isDefined), distinctUntilChanged()));
    }

    setContext(context: LibraryToggleContext): void {
        this.setState({ context, savedFlag: { state: 'notAsked' }, mutation: { state: 'notAsked' } });
    }

    toggle$(): Observable<unknown> {
        return defer(() => {
            const { context, savedFlag, mutation } = this.get();

            if (!context?.media.id || savedFlag.state === 'loading' || mutation.state === 'loading') {
                return EMPTY;
            }

            const copy = LIBRARY_TOGGLE_COPY[context.flag];

            if (!this.userSessionStoreService.isAuthenticated()) {
                return this.signinDialogService.open$().pipe(
                    // Sign-in failures are reported without changing the saved library flag.
                    catchError(() => this.snackbarService.showError$(copy.errorMessage)),
                );
            }

            const isActive =
                mutation.state === 'success' ? mutation.data : savedFlag.state === 'success' && savedFlag.data;

            this.patchState({ mutation: { state: 'loading' } });

            return this.userLibraryService
                .updateLibraryFlag$(context.flag, context.media.id, context.media.mediaType, !isActive)
                .pipe(
                    tap((data) =>
                        this.patchState({
                            savedFlag: { state: 'success', data },
                            mutation: { state: 'success', data },
                        }),
                    ),
                    // Keep the saved flag unchanged when the update fails and show the error beside the action.
                    catchError((error: unknown) => {
                        this.patchState({ mutation: { state: 'failure', error } });
                        return this.snackbarService.showError$(copy.errorMessage);
                    }),
                    takeUntil(this.select((state) => state.context).pipe(filter((current) => current !== context))),
                );
        });
    }

    private readonly loadFlag = this.effect<LibraryToggleContext>((context$) =>
        combineLatest([context$, this.userSessionStoreService.settledIsAuthenticated$.pipe(startWith(null))]).pipe(
            switchMap(([context, isAuthenticated]) => {
                const { media, flag, libraryState } = context;
                this.patchState({ mutation: { state: 'notAsked' } });

                if (libraryState) {
                    this.patchState({
                        savedFlag: mapRemoteData(libraryState, (data) =>
                            flag === 'watchlist' ? !!data.inWatchlist : !!data.favorite,
                        ),
                    });
                    return EMPTY;
                }

                this.patchState({
                    savedFlag: media.id && isAuthenticated !== false ? { state: 'loading' } : { state: 'notAsked' },
                });

                if (!media.id || !isAuthenticated) {
                    return EMPTY;
                }

                return this.userLibraryService.getLibraryFlag$(flag, media.id, media.mediaType).pipe(
                    tap((data) => this.patchState({ savedFlag: { state: 'success', data } })),
                    // A failed background lookup leaves the action available for retry.
                    catchError((error: unknown) => {
                        this.patchState({ savedFlag: { state: 'failure', error } });
                        return EMPTY;
                    }),
                );
            }),
        ),
    );
}
