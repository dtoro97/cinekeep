import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, switchMap, tap, throwError } from 'rxjs';

import { FavoriteControllerService } from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    CardItem,
    MediaType,
    RemoteData,
    SortDirection,
    UserLibraryService,
    isDefined,
    pluralize,
    remoteData,
    remoteSuccess,
    toRating,
    toSnapshotCardItem,
} from '../../../shared';
import { DEFAULT_USER_ACCOUNT_SORT_DIRECTION } from '../user-list-sort-options';

interface UserFavouritesPageState {
    readonly mediaType: MediaType;
    readonly sortDirection: SortDirection;
    readonly pageIndex: number;
    readonly total: number;
    readonly items: RemoteData<CardItem[]>;
}

const INITIAL_STATE: UserFavouritesPageState = {
    mediaType: 'movie',
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
    pageIndex: 0,
    total: 0,
    items: { state: 'notAsked' },
};

@Injectable()
export class UserFavouritesPageStoreService extends ComponentStore<UserFavouritesPageState> {
    readonly favourites$ = this.select(({ mediaType, sortDirection, pageIndex, total, items }) => {
        const loadedItems = remoteData(items, []);
        const isLoaded = items.state === 'success';

        return {
            mediaType,
            sortDirection,
            pageIndex,
            pageSize: PAGE_SIZE,
            total,
            totalLabel: mediaType === 'tv' ? `${total} TV series` : pluralize(total, 'movie'),
            items: loadedItems,
            showSkeleton: items.state === 'loading',
            showTotal: isLoaded,
            hasItems: loadedItems.length > 0,
            showEmpty: isLoaded && loadedItems.length === 0,
            showPaginator: loadedItems.length > 0 && total > PAGE_SIZE,
        };
    });

    constructor(
        private readonly favoriteController: FavoriteControllerService,
        private readonly userLibraryService: UserLibraryService,
    ) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number): Observable<unknown> {
        this.patchState({ pageIndex, items: { state: 'loading' } });

        return this.fetchPage$(pageIndex);
    }

    setMediaType$(mediaType: MediaType): Observable<unknown> {
        if (mediaType === this.get().mediaType) {
            return EMPTY;
        }

        this.patchState({ mediaType });

        return this.loadPage$(0);
    }

    toggleSortDirection$(): Observable<unknown> {
        this.patchState(({ sortDirection }) => ({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' }));

        return this.loadPage$(0);
    }

    remove$(item: CardItem): Observable<unknown> {
        const { pageIndex, items } = this.get();
        // Removing the last title of a page moves back to the previous one.
        const nextPageIndex = remoteData(items, []).length === 1 ? Math.max(0, pageIndex - 1) : pageIndex;

        return this.userLibraryService
            .updateFavorite$(item.id, item.mediaType, false)
            .pipe(switchMap(() => this.fetchPage$(nextPageIndex)));
    }

    private fetchPage$(pageIndex: number): Observable<unknown> {
        const { mediaType, sortDirection } = this.get();

        return this.favoriteController
            .getFavorites({ mediaType, page: pageIndex, size: PAGE_SIZE, sortDirection })
            .pipe(
                tap((response) =>
                    this.patchState({
                        pageIndex,
                        total: response.totalElements ?? 0,
                        items: remoteSuccess(
                            (response.content ?? [])
                                .map((item) => toSnapshotCardItem(item, toRating(item.voteAverage)))
                                .filter(isDefined),
                        ),
                    }),
                ),
                catchError((error: unknown) => {
                    this.patchState({ items: { state: 'failure', error } });
                    return throwError(() => error);
                }),
            );
    }
}
