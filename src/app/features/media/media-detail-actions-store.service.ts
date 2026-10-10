import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, forkJoin, map, merge, of, switchMap, tap, throwError } from 'rxjs';

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
    remoteData,
    remoteSuccess,
    toMediaKey,
    toMediaSnapshotRequest,
} from '../../shared';
import { toUserRatingDisplay, UserRatingState, writeUserRating$ } from './user-rating-state';
import { MediaStoreService } from './media-store.service';
import type { MediaTarget } from './media-target';

export interface MediaListLink {
    readonly id: number;
    readonly name: string;
}

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
    /** The signed-in user's lists that already contain the title. */
    readonly memberLists: RemoteData<MediaListLink[]>;
}

interface MediaActionsState {
    readonly target: MediaTarget | null;
    readonly actionsByMediaKey: Readonly<Record<string, MediaActionResource>>;
    /** Set while the user's lists load for the "add to list" dialog. */
    readonly isListDialogPending: boolean;
}

const EMPTY_ACTION_RESOURCE: MediaActionResource = {
    userRating: { state: 'notAsked' },
    ratingPending: false,
    watchlistState: { state: 'notAsked' },
    favoriteState: { state: 'notAsked' },
    memberLists: { state: 'notAsked' },
};

const INITIAL_STATE: MediaActionsState = {
    target: null,
    actionsByMediaKey: {},
    isListDialogPending: false,
};

/** The signed-in user's watchlist, favourite, rating and list actions for a title, kept per title. */
@Injectable()
export class MediaDetailActionsStoreService extends ComponentStore<MediaActionsState> {
    readonly userRating$ = this.select((state) => toUserRatingDisplay(toActiveActions(state), state.target !== null));

    readonly library$ = this.select((state) => {
        const resource = toActiveActions(state);
        const { watchlistState, favoriteState, memberLists } = resource;
        const rating = toUserRatingDisplay(resource, state.target !== null);
        const isInWatchlist = watchlistState.state === 'success' && watchlistState.data;
        const isFavorite = favoriteState.state === 'success' && favoriteState.data;
        const pending = watchlistState.state === 'loading' || favoriteState.state === 'loading';
        const lists = remoteData(memberLists, []);

        return {
            rating,
            isInWatchlist,
            isFavorite,
            isInLibrary: isInWatchlist || isFavorite || rating.currentRating !== null,
            pending,
            isListButtonDisabled: pending || state.isListDialogPending,
            watchlistLabel: isInWatchlist ? 'On your watchlist' : 'Not on your watchlist',
            watchlistActionLabel: isInWatchlist ? 'Remove' : 'Add to watchlist',
            favoriteLabel: isFavorite ? 'A favourite' : 'Not a favourite',
            favoriteActionLabel: isFavorite ? 'Remove' : 'Add',
            lists,
            hasLists: lists.length > 0,
            listsLabel: lists.length ? `In ${lists.length} of your lists` : 'Not in any of your lists',
        };
    });

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

    /** Loads the title's actions, and loads them again whenever the user signs in or out. */
    load$(target: MediaTarget): Observable<unknown> {
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
                    memberLists: { state: 'loading' },
                },
            },
        }));

        return this.userSessionStore.settledIsAuthenticated$.pipe(
            switchMap((isAuthenticated) =>
                merge(
                    (isAuthenticated
                        ? this.userLibraryService.getMediaState$(target.id, target.type)
                        : of<MediaStateResponse | null>(null)
                    ).pipe(
                        tap((mediaState) =>
                            this.patchActionResource(target, {
                                userRating: remoteSuccess(
                                    typeof mediaState?.rating === 'number'
                                        ? normalizeRatingValue(mediaState.rating)
                                        : null,
                                ),
                                watchlistState: remoteSuccess(!!mediaState?.inWatchlist),
                                favoriteState: remoteSuccess(!!mediaState?.favorite),
                            }),
                        ),
                        // Unknown actions show as not set, so the buttons stay usable.
                        catchError(() => {
                            this.patchActionResource(target, {
                                userRating: remoteSuccess(null),
                                watchlistState: remoteSuccess(false),
                                favoriteState: remoteSuccess(false),
                            });
                            return of(null);
                        }),
                    ),
                    (isAuthenticated
                        ? this.getUserLists$().pipe(
                              map((lists) =>
                                  lists.filter(({ itemPresent }) => itemPresent).map(({ id, name }) => ({ id, name })),
                              ),
                              // Without the user's lists the panel shows the title as in none of them.
                              catchError(() => of<MediaListLink[]>([])),
                          )
                        : of<MediaListLink[]>([])
                    ).pipe(tap((lists) => this.patchActionResource(target, { memberLists: remoteSuccess(lists) }))),
                ),
            ),
        );
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

        const resource = toActiveActions(state);
        const currentState = flag === 'watchlist' ? resource.watchlistState : resource.favoriteState;
        const previousValue = currentState.state === 'success' ? currentState.data : false;
        const toPatch = (flagState: RemoteData<boolean>): Partial<MediaActionResource> =>
            flag === 'watchlist' ? { watchlistState: flagState } : { favoriteState: flagState };

        this.patchActionResource(target, toPatch({ state: 'loading' }));

        return this.userLibraryService
            .updateLibraryFlag$(flag, target.id, target.type, !previousValue, this.loadedSnapshot(target))
            .pipe(
                tap((result) => this.patchActionResource(target, toPatch(remoteSuccess(result)))),
                catchError((error) => {
                    this.patchActionResource(target, toPatch(remoteSuccess(previousValue)));
                    return throwError(() => error);
                }),
            );
    }

    addToList$(list: MediaListLink): Observable<unknown> {
        const target = this.get().target;

        if (!target) {
            return throwError(() => new Error('No media action context is available.'));
        }

        return this.userLibraryService.addToList$(list.id, target.id, target.type, this.loadedSnapshot(target)).pipe(
            tap(() => {
                const memberLists = remoteData(toActiveActions(this.get()).memberLists, []);

                if (!memberLists.some(({ id }) => id === list.id)) {
                    this.patchActionResource(target, { memberLists: remoteSuccess([...memberLists, list]) });
                }
            }),
        );
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

    setListDialogPending(isListDialogPending: boolean): void {
        this.patchState({ isListDialogPending });
    }

    private loadedSnapshot(target: MediaTarget): SeriesSnapshotRequest | undefined {
        const media = this.mediaStore.currentMediaFor(target);

        return media ? toMediaSnapshotRequest(media, target.type) : undefined;
    }

    private patchActionResource(target: MediaTarget, patch: Partial<MediaActionResource>): void {
        const key = toMediaKey(target.type, target.id);

        this.patchState((state) => ({
            actionsByMediaKey: {
                ...state.actionsByMediaKey,
                [key]: { ...(state.actionsByMediaKey[key] ?? EMPTY_ACTION_RESOURCE), ...patch },
            },
        }));
    }
}

const toActiveActions = ({ target, actionsByMediaKey }: MediaActionsState): MediaActionResource =>
    (target && actionsByMediaKey[toMediaKey(target.type, target.id)]) || EMPTY_ACTION_RESOURCE;
