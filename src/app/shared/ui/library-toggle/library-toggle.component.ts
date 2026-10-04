import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';

import { EMPTY, catchError } from 'rxjs';

import type { MediaStateResponse } from '../../../api-cinekeep';
import type { LibraryFlag, MediaType, RemoteData } from '../../types';
import { SnackbarService, SnackbarType } from '../../services/snackbar.service';
import { UserLibraryService } from '../../services/user-library.service';
import { UserSessionStoreService } from '../../services/user-session-store.service';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { SigninDialogService } from '../signin-dialog/signin-dialog.service';
import { SnackbarComponent } from '../snackbar/snackbar.component';

interface ToggleTarget {
    readonly mediaId: number;
    readonly mediaType: MediaType;
}

interface LibraryToggleCopy {
    readonly iconClass: string;
    readonly activeLabel: string;
    readonly inactiveLabel: string;
    readonly activeAriaLabel: (title: string) => string;
    readonly inactiveAriaLabel: (title: string) => string;
    readonly errorMessage: string;
}

const LIBRARY_TOGGLE_COPY: Record<LibraryFlag, LibraryToggleCopy> = {
    watchlist: {
        iconClass: 'fa-bookmark',
        activeLabel: 'On watchlist',
        inactiveLabel: 'Add to watchlist',
        activeAriaLabel: (title) => `${title} is on your watchlist`,
        inactiveAriaLabel: (title) => `Add ${title} to watchlist`,
        errorMessage: 'Could not update your watchlist.',
    },
    favorite: {
        iconClass: 'fa-heart',
        activeLabel: 'In favorites',
        inactiveLabel: 'Add to favorites',
        activeAriaLabel: (title) => `${title} is in your favorites`,
        inactiveAriaLabel: (title) => `Add ${title} to favorites`,
        errorMessage: 'Could not update your favorites.',
    },
};

/** Adds a title to, or removes it from, the user's watchlist or favorites. */
@Component({
    selector: 'app-library-toggle',
    imports: [IconButtonComponent, MatButtonModule],
    templateUrl: './library-toggle.component.html',
    styleUrl: './library-toggle.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryToggleComponent {
    readonly flag = input.required<LibraryFlag>();
    readonly mediaId = input.required<number>();
    readonly mediaType = input.required<MediaType>();
    readonly title = input.required<string>();
    readonly iconOnly = input(false);
    /** State loaded by the parent list in one batch; when omitted the toggle fetches its own. */
    readonly libraryState = input<RemoteData<MediaStateResponse> | null>(null);

    readonly active = signal(false);
    readonly pending = signal(false);

    private readonly copy = computed(() => LIBRARY_TOGGLE_COPY[this.flag()]);

    readonly iconClass = computed(() => this.copy().iconClass);
    readonly label = computed(() => (this.active() ? this.copy().activeLabel : this.copy().inactiveLabel));
    readonly ariaLabel = computed(() =>
        this.active() ? this.copy().activeAriaLabel(this.title()) : this.copy().inactiveAriaLabel(this.title()),
    );

    private readonly target = computed<ToggleTarget | null>(() => {
        const mediaId = this.mediaId();
        const mediaType = this.mediaType();

        if (!mediaId || !mediaType) {
            return null;
        }

        return { mediaId, mediaType };
    });

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly snackbar: SnackbarService,
        private readonly userLibraryService: UserLibraryService,
        private readonly signinDialog: SigninDialogService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        // `null` until the browser session restore has settled.
        const isAuthenticated = toSignal(this.userSessionStore.settledIsAuthenticated$, { initialValue: null });

        // Re-reads the saved state when the target changes or the user signs in or out.
        effect((onCleanup) => {
            const flag = this.flag();
            const target = this.target();
            const libraryState = this.libraryState();

            if (libraryState) {
                this.active.set(
                    libraryState.state === 'success' &&
                        (flag === 'watchlist' ? !!libraryState.data.inWatchlist : !!libraryState.data.favorite),
                );
                this.pending.set(libraryState.state === 'loading');
                return;
            }

            const authenticated = isAuthenticated();

            this.active.set(false);
            this.pending.set(!!target && authenticated !== false);

            if (!target || !authenticated) {
                return;
            }

            const subscription = this.userLibraryService
                .getLibraryFlag$(flag, target.mediaId, target.mediaType)
                .pipe(
                    catchError(() => {
                        this.pending.set(false);
                        return EMPTY;
                    }),
                )
                .subscribe((active) => {
                    this.active.set(active);
                    this.pending.set(false);
                });

            onCleanup(() => {
                subscription.unsubscribe();
            });
        });
    }

    toggle(event?: Event): void {
        event?.preventDefault();
        event?.stopPropagation();

        const target = this.target();

        if (!target || this.pending()) {
            return;
        }

        if (!this.userSessionStore.isAuthenticated()) {
            this.signinDialog
                .open$()
                .pipe(
                    catchError(() => this.showError()),
                    takeUntilDestroyed(this.destroyRef),
                )
                .subscribe();
            return;
        }

        this.pending.set(true);

        const nextValue = !this.active();

        this.userLibraryService
            .updateLibraryFlag$(this.flag(), target.mediaId, target.mediaType, nextValue)
            .pipe(
                catchError(() => {
                    this.pending.set(false);
                    return this.showError();
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe(() => {
                this.active.set(nextValue);
                this.pending.set(false);
            });
    }

    private showError() {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message: this.copy().errorMessage,
            type: SnackbarType.Error,
        });
        return EMPTY;
    }
}
