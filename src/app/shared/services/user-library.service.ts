import { Injectable } from '@angular/core';

import { EMPTY, Observable, catchError, concatMap, map, of, startWith, switchMap } from 'rxjs';

import {
    FavoriteControllerService,
    MediaStateControllerService,
    MediaStateResponse,
    SeriesSnapshotRequest,
    UserListControllerService,
    UserListItemControllerService,
    UserListResponse,
    WatchlistControllerService,
} from '../../api-cinekeep';
import { LibraryFlag, MediaType, RemoteData } from '../types';
import { toMediaKey } from '../utils/media-key';
import { MediaSnapshotService } from './media-snapshot.service';
import { UserSessionStoreService } from './user-session-store.service';

/** One media-state entry per title, keyed by `mediaType:id`. */
export type MediaStateLookup = ReadonlyMap<string, MediaStateResponse>;

export interface MediaKey {
    readonly id: number;
    readonly mediaType: MediaType;
}

/** Per-title state for a library toggle: not asked while signed out, loading until fetched. */
export const toLibraryState = (lookup: MediaStateLookup | null, item: MediaKey): RemoteData<MediaStateResponse> => {
    if (!lookup) {
        return { state: 'notAsked' };
    }

    const state = lookup.get(toMediaKey(item.mediaType, item.id));
    return state ? { state: 'success', data: state } : { state: 'loading' };
};

@Injectable({ providedIn: 'root' })
export class UserLibraryService {
    constructor(
        private readonly favoriteController: FavoriteControllerService,
        private readonly mediaSnapshotService: MediaSnapshotService,
        private readonly mediaStateController: MediaStateControllerService,
        private readonly userListController: UserListControllerService,
        private readonly userListItemController: UserListItemControllerService,
        private readonly watchlistController: WatchlistControllerService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {}

    updateWatchlist$(
        mediaId: number,
        mediaType: MediaType,
        watchlist: boolean,
        snapshot?: SeriesSnapshotRequest,
    ): Observable<boolean> {
        const request$ = watchlist
            ? this.saveWithSnapshot$(mediaId, mediaType, snapshot, (request) =>
                  this.watchlistController.addToWatchlist({ watchlistItemRequest: request }),
              )
            : this.watchlistController.removeFromWatchlist({ mediaType, tmdbId: mediaId });

        return request$.pipe(map(() => watchlist));
    }

    /** Whether the title is on the watchlist or in favorites. */
    getLibraryFlag$(flag: LibraryFlag, mediaId: number, mediaType: MediaType): Observable<boolean> {
        return this.getMediaState$(mediaId, mediaType).pipe(
            map((state) => (flag === 'watchlist' ? !!state.inWatchlist : !!state.favorite)),
        );
    }

    updateLibraryFlag$(
        flag: LibraryFlag,
        mediaId: number,
        mediaType: MediaType,
        value: boolean,
        snapshot?: SeriesSnapshotRequest,
    ): Observable<boolean> {
        return flag === 'watchlist'
            ? this.updateWatchlist$(mediaId, mediaType, value, snapshot)
            : this.updateFavorite$(mediaId, mediaType, value, snapshot);
    }

    updateFavorite$(
        mediaId: number,
        mediaType: MediaType,
        favorite: boolean,
        snapshot?: SeriesSnapshotRequest,
    ): Observable<boolean> {
        const request$ = favorite
            ? this.saveWithSnapshot$(mediaId, mediaType, snapshot, (request) =>
                  this.favoriteController.addToFavorites({ favoriteItemRequest: request }),
              )
            : this.favoriteController.removeFromFavorites({ mediaType, tmdbId: mediaId });

        return request$.pipe(map(() => favorite));
    }

    createList$(name: string, description: string, sortBy: UserListResponse.SortByEnum): Observable<number> {
        return this.userListController.createList({ createUserListRequest: { name, description, sortBy } }).pipe(
            map((list) => {
                if (!list.id) {
                    throw new Error('Unable to create your list.');
                }

                return list.id;
            }),
        );
    }

    addToList$(listId: number, mediaId: number, mediaType: MediaType, snapshot?: SeriesSnapshotRequest) {
        return this.saveWithSnapshot$(mediaId, mediaType, snapshot, (request) =>
            this.userListItemController.addItem({ listId, listItemRequest: request }),
        );
    }

    getMediaState$(mediaId: number, mediaType: MediaType): Observable<MediaStateResponse> {
        return this.mediaStateController.getMediaState({ mediaType, tmdbId: mediaId });
    }

    /** States for up to 100 movies and 100 TV series in one request. */
    getMediaStates$(items: readonly MediaKey[]): Observable<MediaStateLookup> {
        return this.mediaStateController
            .getMediaStates({
                movieIds: items.filter((item) => item.mediaType === 'movie').map((item) => item.id),
                tvIds: items.filter((item) => item.mediaType === 'tv').map((item) => item.id),
            })
            .pipe(
                map(
                    (states) =>
                        new Map(items.map((item) => [toMediaKey(item.mediaType, item.id), states[item.mediaType]?.[item.id] ?? {}])),
                ),
            );
    }

    /**
     * Library states for the titles a list has loaded. Fetches only titles it has not seen,
     * so "show more" asks for the new page alone; emits `null` while signed out.
     */
    mediaStates$(items$: Observable<readonly MediaKey[]>): Observable<MediaStateLookup | null> {
        return this.userSessionStore.settledIsAuthenticated$.pipe(
            switchMap((authenticated) => {
                if (!authenticated) {
                    return of(null);
                }

                const lookup = new Map<string, MediaStateResponse>();

                return items$.pipe(
                    concatMap((items) => {
                        const missing = items.filter((item) => !lookup.has(toMediaKey(item.mediaType, item.id)));

                        if (!missing.length) {
                            return EMPTY;
                        }

                        return this.getMediaStates$(missing).pipe(
                            catchError(() => of(new Map(missing.map((item) => [toMediaKey(item.mediaType, item.id), {}])))),
                            map((states) => {
                                states.forEach((state, key) => lookup.set(key, state));
                                return new Map(lookup);
                            }),
                        );
                    }),
                    startWith(new Map(lookup)),
                );
            }),
        );
    }

    /** Saves a title with its snapshot, fetching the snapshot from TMDb when none is passed. */
    private saveWithSnapshot$<T>(
        mediaId: number,
        mediaType: MediaType,
        snapshot: SeriesSnapshotRequest | undefined,
        save: (request: SeriesSnapshotRequest & { tmdbId: number; mediaType: MediaType }) => Observable<T>,
    ): Observable<T> {
        return this.mediaSnapshotService
            .resolveMediaSnapshot$(mediaId, mediaType, snapshot)
            .pipe(switchMap((resolved) => save({ ...resolved, tmdbId: mediaId, mediaType })));
    }
}
