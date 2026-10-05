import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';

import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';

import {
    MediaStateResponse,
    RatingControllerService,
    SeriesSnapshotRequest,
    UserListControllerService,
} from '../../api-cinekeep';
import { BACKEND_MAX_PAGE_SIZE } from '../../constants';
import {
    LibraryFlag,
    MediaRatingService,
    RemoteData,
    isDefined,
    UserLibraryService,
    UserSessionStoreService,
    normalizeRatingValue,
    remoteSuccess,
    toMediaKey,
    toMediaSnapshotRequest,
} from '../../shared';
import { toUserRatingDisplay, UserRatingState, writeUserRating$ } from './user-rating-state';
import { MediaStoreService } from './media-store.service';
import type { MediaTarget } from './media-target';

export interface MediaUserListSummary {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly itemCount: number;
    readonly itemPresent: boolean;
    readonly posterPath: string | null;
}

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
            target ? (actionsByMediaKey[toMediaKey(target.type, target.id)] ?? EMPTY_ACTION_RESOURCE) : EMPTY_ACTION_RESOURCE,
    );

    readonly watchlistState$ = this.activeActions$.pipe(map((actions) => actions.watchlistState));
    readonly favoriteState$ = this.activeActions$.pipe(map((actions) => actions.favoriteState));

    readonly userRating$ = this.select(this.activeActions$, this.target$, (actions, target) =>
        toUserRatingDisplay(actions, target !== null),
    );

    readonly listActions$ = this.select(
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
        private readonly ratingControllerService: RatingControllerService,
        private readonly userLibraryService: UserLibraryService,
        private readonly userListControllerService: UserListControllerService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super(INITIAL_STATE);
    }

    updateMedia(target: MediaTarget): void {
        const key = toMediaKey(target.type, target.id);

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
        return writeUserRating$(
            this.ratingControllerService.deleteRating({ mediaType: target.type, tmdbId: target.id }),
            null,
            (patch) => this.patchActionResource(target, patch),
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

    /** The user's lists, each flagged with whether it already contains the title. */
    getUserLists$(): Observable<MediaUserListSummary[]> {
        const target = this.get().target;

        if (!target) {
            return throwError(() => new Error('No media action context is available.'));
        }

        return forkJoin({
            lists: this.userListControllerService.getLists({ page: 0, size: BACKEND_MAX_PAGE_SIZE }),
            memberListIds: this.userListControllerService
                .getMembership({ mediaType: target.type, tmdbId: target.id })
                .pipe(map((response) => new Set(response.listIds ?? []))),
        }).pipe(
            map(({ lists, memberListIds }) =>
                (lists.content ?? [])
                    .map((list): MediaUserListSummary | null => {
                        const name = list.name?.trim();

                        return list.id && name
                            ? {
                                  id: list.id,
                                  name,
                                  description: list.description?.trim() || null,
                                  itemCount: list.itemCount ?? 0,
                                  itemPresent: memberListIds.has(list.id),
                                  posterPath: list.cover?.posterPath ?? null,
                              }
                            : null;
                    })
                    .filter(isDefined),
            ),
        );
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

    private loadedSnapshot(target: MediaTarget): SeriesSnapshotRequest | undefined {
        const media = this.mediaStore.currentMediaFor(target);

        return media ? toMediaSnapshotRequest(media, target.type) : undefined;
    }

    private getActionResource(state: MediaActionsState, target: MediaTarget): MediaActionResource {
        return state.actionsByMediaKey[toMediaKey(target.type, target.id)] ?? EMPTY_ACTION_RESOURCE;
    }

    private patchActionResource(target: MediaTarget, patch: Partial<MediaActionResource>): void {
        this.patchState((state) => {
            const key = toMediaKey(target.type, target.id);

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
