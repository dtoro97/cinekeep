import { Injectable } from '@angular/core';

import { EMPTY, Observable, expand, finalize, forkJoin, map, reduce, share, switchMap } from 'rxjs';

import {
    FavoriteControllerService,
    MediaStateControllerService,
    MediaStateResponse,
    UpdateUserListRequest,
    UserListControllerService,
    UserListDetailsResponse,
    UserListItemControllerService,
    WatchlistControllerService,
} from '../../api-cinekeep';
import { MediaSnapshotRequest } from '../mappers/media-snapshot.mapper';
import { LibraryFlag, MediaType, UserListSortBy } from '../types';
import { isDefined } from '../utils';
import { MediaSnapshotService } from './media-snapshot.service';

export interface MediaUserListSummary {
    id: number;
    name: string;
    description: string | null;
    itemCount: number;
    itemPresent: boolean;
    posterPath: string | null;
}

/** The largest page the backend serves. */
const MAX_PAGE_SIZE = 100;
@Injectable({ providedIn: 'root' })
export class UserLibraryService {
    private readonly mediaStateRequests = new Map<string, Observable<MediaStateResponse>>();

    constructor(
        private readonly favoriteController: FavoriteControllerService,
        private readonly mediaSnapshotService: MediaSnapshotService,
        private readonly mediaStateController: MediaStateControllerService,
        private readonly userListController: UserListControllerService,
        private readonly userListItemController: UserListItemControllerService,
        private readonly watchlistController: WatchlistControllerService,
    ) {}

    updateWatchlist$(
        mediaId: number,
        mediaType: MediaType,
        watchlist: boolean,
        snapshot?: MediaSnapshotRequest,
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
        snapshot?: MediaSnapshotRequest,
    ): Observable<boolean> {
        return flag === 'watchlist'
            ? this.updateWatchlist$(mediaId, mediaType, value, snapshot)
            : this.updateFavorite$(mediaId, mediaType, value, snapshot);
    }

    updateFavorite$(
        mediaId: number,
        mediaType: MediaType,
        favorite: boolean,
        snapshot?: MediaSnapshotRequest,
    ): Observable<boolean> {
        const request$ = favorite
            ? this.saveWithSnapshot$(mediaId, mediaType, snapshot, (request) =>
                  this.favoriteController.addToFavorites({ favoriteItemRequest: request }),
              )
            : this.favoriteController.removeFromFavorites({ mediaType, tmdbId: mediaId });

        return request$.pipe(map(() => favorite));
    }

    /** The user's lists, each flagged with whether it already contains the given title. */
    getUserLists$(mediaId: number, mediaType: MediaType): Observable<MediaUserListSummary[]> {
        return forkJoin({
            lists: this.userListController.getLists({ page: 0, size: MAX_PAGE_SIZE }),
            memberListIds: this.userListController
                .getMembership({ mediaType, tmdbId: mediaId })
                .pipe(map((response) => new Set(response.listIds ?? []))),
        }).pipe(
            map(({ lists, memberListIds }) =>
                (lists.content ?? [])
                    .map((list): MediaUserListSummary | null => {
                        const name = list.name?.trim();

                        if (!list.id || !name) {
                            return null;
                        }

                        return {
                            id: list.id,
                            name,
                            description: list.description?.trim() || null,
                            itemCount: list.itemCount ?? 0,
                            itemPresent: memberListIds.has(list.id),
                            posterPath: list.cover?.posterPath ?? null,
                        };
                    })
                    .filter(isDefined),
            ),
        );
    }

    /** `pageIndex` is zero-based, like the backend; no `sortBy` uses the list's default order. */
    getListDetails$(
        listId: number,
        pageIndex: number,
        pageSize: number,
        sortBy: UserListSortBy | undefined,
    ): Observable<UserListDetailsResponse> {
        return this.userListController.getListDetails({ listId, page: pageIndex, size: pageSize, sortBy });
    }

    createList$(name: string, description: string, isPublic: boolean, sortBy: UserListSortBy): Observable<number> {
        return this.userListController
            .createList({ createUserListRequest: { name, description, isPublic, sortBy } })
            .pipe(
                map((list) => {
                    if (!list.id) {
                        throw new Error('Unable to create your list.');
                    }

                    return list.id;
                }),
            );
    }

    addToList$(
        listId: number,
        mediaId: number,
        mediaType: MediaType,
        snapshot?: MediaSnapshotRequest,
    ) {
        return this.saveWithSnapshot$(mediaId, mediaType, snapshot, (request) =>
            this.userListItemController.addItem({ listId, listItemRequest: request }),
        );
    }

    /** Every `mediaType:tmdbId` key in a list, one request per 100 items. */
    getListItemKeys$(listId: number): Observable<ReadonlySet<string>> {
        const fetchPage$ = (pageIndex: number) => this.getListDetails$(listId, pageIndex, MAX_PAGE_SIZE, undefined);

        return fetchPage$(0).pipe(
            expand((result) => {
                const nextPageIndex = (result.items?.page ?? 0) + 1;

                return nextPageIndex < (result.items?.totalPages ?? 0) ? fetchPage$(nextPageIndex) : EMPTY;
            }),
            reduce((keys, result) => {
                for (const item of result.items?.content ?? []) {
                    keys.add(`${item.mediaType}:${item.tmdbId}`);
                }

                return keys;
            }, new Set<string>()),
        );
    }

    updateList$(listId: number, request: UpdateUserListRequest) {
        return this.userListController
            .updateList({ listId, updateUserListRequest: request });
    }

    clearList$(listId: number) {
        return this.userListItemController
            .clearItems({ listId });
    }

    deleteList$(listId: number) {
        return this.userListController
            .deleteList({ listId });
    }

    removeItem$(listId: number, mediaId: number, mediaType: MediaType) {
        return this.userListItemController
            .removeItem({ listId, mediaType, tmdbId: mediaId });
    }

    updateItemComment$(listId: number, mediaId: number, mediaType: MediaType, comment: string) {
        return this.userListItemController
            .updateItem({ listId, mediaType, tmdbId: mediaId, updateListItemRequest: { comment } });
    }

    /** Callers asking for the same title at the same time, like a card's two toggles, share one request. */
    getMediaState$(mediaId: number, mediaType: MediaType): Observable<MediaStateResponse> {
        const key = `${mediaType}:${mediaId}`;
        const inFlight$ = this.mediaStateRequests.get(key);

        if (inFlight$) {
            return inFlight$;
        }

        const request$ = this.mediaStateController
            .getMediaState({ mediaType, tmdbId: mediaId })
            .pipe(
                finalize(() => this.mediaStateRequests.delete(key)),
                share(),
            );

        this.mediaStateRequests.set(key, request$);
        return request$;
    }

    /** Saves a title with its snapshot, fetching the snapshot from TMDb when none is passed. */
    private saveWithSnapshot$<T>(
        mediaId: number,
        mediaType: MediaType,
        snapshot: MediaSnapshotRequest | undefined,
        save: (request: MediaSnapshotRequest & { tmdbId: number; mediaType: MediaType }) => Observable<T>,
    ): Observable<T> {
        return this.mediaSnapshotService
            .resolveMediaSnapshot$(mediaId, mediaType, snapshot)
            .pipe(switchMap((resolved) => save({ ...resolved, tmdbId: mediaId, mediaType })));
    }
}
