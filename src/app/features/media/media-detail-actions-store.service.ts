import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';

import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

import { MediaStateResponse } from '../../api-cinekeep';
import {
    LibraryFlag,
    MediaSnapshotRequest,
    MediaRatingService,
    RemoteData,
    UserLibraryService,
    UserRatingState,
    UserSessionStoreService,
    normalizeRatingValue,
    remoteSuccess,
    toMediaSnapshotRequest,
    toUserRatingVm,
    writeUserRating$,
} from '../../shared';
import { MediaStoreService } from './media-store.service';
import { type MediaTarget, toMediaKey } from './media-target';

interface MediaActionResource extends UserRatingState {
    readonly watchlistState: RemoteData<boolean>;
    readonly favoriteState: RemoteData<boolean>;
}

interface MediaActionsState {
    readonly target: MediaTarget | null;
    readonly actionsByMediaKey: Readonly<Record<string, MediaActionResource>>;
}

const EMPTY_ACTION_RESOURCE: MediaActionResource = {
    userRating: { state: 'notAsked' },
    ratingPending: false,
    watchlistState: { state: 'notAsked' },
    favoriteState: { state: 'notAsked' },
};

const INITIAL_STATE: MediaActionsState = {
    target: null,
    actionsByMediaKey: {},
};

@Injectable()
export class MediaDetailActionsStore extends ComponentStore<MediaActionsState> {
    private readonly target$ = this.select((state) => state.target);

    private readonly activeActions$ = this.select(
        this.target$,
        this.select((state) => state.actionsByMediaKey),
        (target, actionsByMediaKey) =>
            target ? (actionsByMediaKey[toMediaKey(target)] ?? EMPTY_ACTION_RESOURCE) : EMPTY_ACTION_RESOURCE,
    );

    readonly watchlistState$ = this.activeActions$.pipe(map((actions) => actions.watchlistState));
    readonly favoriteState$ = this.activeActions$.pipe(map((actions) => actions.favoriteState));

    readonly ratingVm$ = this.select(this.activeActions$, this.target$, (actions, target) =>
        toUserRatingVm(actions, target !== null),
    );

    readonly listActionsVm$ = this.select(
        this.watchlistState$,
        this.favoriteState$,
        (watchlistState, favoriteState) => ({
            isInWatchlist: watchlistState.state === 'success' ? watchlistState.data : false,
            isFavorite: favoriteState.state === 'success' ? favoriteState.data : false,
            pending: watchlistState.state === 'loading' || favoriteState.state === 'loading',
            watchlistLabel:
                watchlistState.state === 'success' && watchlistState.data ? 'On watchlist' : 'Add to watchlist',
            favoriteActionLabel:
                favoriteState.state === 'success' && favoriteState.data ? 'Remove from favorites' : 'Add to favorites',
        }),
    );

    constructor(
        private readonly mediaRatingService: MediaRatingService,
        private readonly mediaStore: MediaStoreService,
        private readonly userLibraryService: UserLibraryService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super(INITIAL_STATE);
    }

    updateMedia(target: MediaTarget): void {
        const key = toMediaKey(target);

        this.patchState((state) => ({
            target,
            actionsByMediaKey: {
                ...state.actionsByMediaKey,
                [key]: state.actionsByMediaKey[key] ?? {
                    userRating: { state: 'loading' },
                    ratingPending: false,
                    watchlistState: { state: 'loading' },
                    favoriteState: { state: 'loading' },
                },
            },
        }));
        this.fetchMediaActionsEffect(target);
    }

    submitUserRating$(target: MediaTarget, value: number): Observable<unknown> {
        return writeUserRating$(
            this.mediaRatingService.rateMedia$(target.id, target.type, value, this.loadedSnapshot(target)),
            normalizeRatingValue(value),
            (patch) => this.patchActionResource(target, patch),
        );
    }

    deleteUserRating$(target: MediaTarget): Observable<unknown> {
        return writeUserRating$(this.mediaRatingService.deleteMediaRating$(target.id, target.type), null, (patch) =>
            this.patchActionResource(target, patch),
        );
    }

    toggleLibraryFlag$(flag: LibraryFlag): Observable<unknown> {
        const state = this.get();
        const target = state.target;

        if (!target) {
            return throwError(() => new Error('No media action context is available.'));
        }

        const resource = this.getActionResource(state, target);
        const currentState = flag === 'watchlist' ? resource.watchlistState : resource.favoriteState;
        const previousValue = currentState.state === 'success' ? currentState.data : false;

        this.patchActionResource(target, toLibraryFlagPatch(flag, { state: 'loading' }));

        return this.userLibraryService
            .updateLibraryFlag$(flag, target.id, target.type, !previousValue, this.loadedSnapshot(target))
            .pipe(
                tap((result) => {
                    this.patchActionResource(target, toLibraryFlagPatch(flag, remoteSuccess(result)));
                }),
                catchError((error) => {
                    this.patchActionResource(target, toLibraryFlagPatch(flag, remoteSuccess(previousValue)));
                    return throwError(() => error);
                }),
            );
    }

    addToList$(listId: number): Observable<unknown> {
        const target = this.get().target;

        if (!target) {
            return throwError(() => new Error('No media action context is available.'));
        }

        return this.userLibraryService.addToList$(listId, target.id, target.type, this.loadedSnapshot(target));
    }

    /** Re-fetches whenever the user signs in or out. */
    private readonly fetchMediaActionsEffect = this.effect<MediaTarget>((params$) =>
        params$.pipe(
            switchMap((target) =>
                this.userSessionStore.settledIsAuthenticated$.pipe(
                    switchMap((isAuthenticated) => this.fetchMediaState$(target, isAuthenticated)),
                ),
            ),
        ),
    );

    private fetchMediaState$(target: MediaTarget, isAuthenticated: boolean) {
        const mediaState$: Observable<MediaStateResponse | null> = isAuthenticated
            ? this.userLibraryService.getMediaState$(target.id, target.type)
            : of(null);

        return mediaState$.pipe(
            tap((mediaState) => {
                this.patchActionResource(target, {
                    userRating: {
                        state: 'success',
                        data: typeof mediaState?.rating === 'number' ? normalizeRatingValue(mediaState.rating) : null,
                    },
                    watchlistState: { state: 'success', data: !!mediaState?.inWatchlist },
                    favoriteState: { state: 'success', data: !!mediaState?.favorite },
                });
            }),
            catchError(() => {
                this.patchActionResource(target, {
                    userRating: { state: 'success', data: null },
                    watchlistState: { state: 'success', data: false },
                    favoriteState: { state: 'success', data: false },
                });
                return of(undefined);
            }),
        );
    }

    private loadedSnapshot(target: MediaTarget): MediaSnapshotRequest | undefined {
        const media = this.mediaStore.currentMediaFor(target);

        return media ? toMediaSnapshotRequest(media, target.type) : undefined;
    }

    private getActionResource(state: MediaActionsState, target: MediaTarget): MediaActionResource {
        return state.actionsByMediaKey[toMediaKey(target)] ?? EMPTY_ACTION_RESOURCE;
    }

    private patchActionResource(target: MediaTarget, patch: Partial<MediaActionResource>): void {
        this.patchState((state) => {
            const key = toMediaKey(target);

            return {
                actionsByMediaKey: {
                    ...state.actionsByMediaKey,
                    [key]: {
                        ...this.getActionResource(state, target),
                        ...patch,
                    },
                },
            };
        });
    }
}

const toLibraryFlagPatch = (flag: LibraryFlag, state: RemoteData<boolean>): Partial<MediaActionResource> =>
    flag === 'watchlist' ? { watchlistState: state } : { favoriteState: state };
