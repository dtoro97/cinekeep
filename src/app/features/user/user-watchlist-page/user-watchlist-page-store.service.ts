import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, switchMap, tap, throwError } from 'rxjs';

import { WatchlistControllerService } from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    getISODate,
    MediaKey,
    MediaListItem,
    mediaListItemToCardItem,
    MediaType,
    RemoteData,
    SortDirection,
    UserLibraryService,
    isDefined,
    pluralize,
    remoteData,
    remoteSuccess,
    toRating,
    toSnapshotMediaListItem,
} from '../../../shared';
import { DEFAULT_USER_ACCOUNT_SORT_DIRECTION } from '../user-list-sort-options';

interface UserWatchlistPageState {
    readonly mediaType: MediaType;
    readonly sortDirection: SortDirection;
    readonly pageIndex: number;
    readonly total: number;
    readonly items: RemoteData<MediaListItem[]>;
}

const INITIAL_STATE: UserWatchlistPageState = {
    mediaType: 'movie',
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
    pageIndex: 0,
    total: 0,
    items: { state: 'notAsked' },
};

@Injectable()
export class UserWatchlistPageStoreService extends ComponentStore<UserWatchlistPageState> {
    readonly watchlist$ = this.select(({ mediaType, sortDirection, pageIndex, total, items }) => {
        const loadedItems = remoteData(items, []);
        const isLoaded = items.state === 'success';
        const today = getISODate(0);
        // Titles without a release date yet count as coming soon too.
        const isComingSoon = (item: MediaListItem) => !item.date || item.date > today;
        const toEntry = (item: MediaListItem) => ({
            item: mediaListItemToCardItem(item),
            source: item,
            dateFormat: isComingSoon(item) ? ('dayMonth' as const) : ('year' as const),
        });
        // The watchlist pages by date added, so it splits into Coming soon and Ready to watch only when
        // every title is on this one page; a split page would leave titles out of either group.
        const isSplit = total <= PAGE_SIZE;

        return {
            mediaType,
            sortDirection,
            pageIndex,
            pageSize: PAGE_SIZE,
            total,
            totalLabel: mediaType === 'tv' ? `${total} TV series` : pluralize(total, 'movie'),
            groups: (isSplit
                ? [
                      {
                          id: 'coming-soon',
                          title: 'Coming soon',
                          entries: loadedItems.filter(isComingSoon).map(toEntry),
                      },
                      {
                          id: 'ready',
                          title: 'Ready to watch',
                          entries: loadedItems.filter((item) => !isComingSoon(item)).map(toEntry),
                      },
                  ]
                : [{ id: 'all', title: null, entries: loadedItems.map(toEntry) }]
            ).filter(({ entries }) => entries.length > 0),
            showSkeleton: items.state === 'loading',
            showTotal: isLoaded,
            hasItems: loadedItems.length > 0,
            showEmpty: isLoaded && loadedItems.length === 0,
            showPaginator: loadedItems.length > 0 && total > PAGE_SIZE,
        };
    });

    constructor(
        private readonly userLibraryService: UserLibraryService,
        private readonly watchlistController: WatchlistControllerService,
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

    remove$(item: MediaKey): Observable<unknown> {
        const { pageIndex, items } = this.get();
        // Removing the last title of a page moves back to the previous one.
        const nextPageIndex = remoteData(items, []).length === 1 ? Math.max(0, pageIndex - 1) : pageIndex;

        return this.userLibraryService
            .updateWatchlist$(item.id, item.mediaType, false)
            .pipe(switchMap(() => this.fetchPage$(nextPageIndex)));
    }

    private fetchPage$(pageIndex: number): Observable<unknown> {
        const { mediaType, sortDirection } = this.get();

        return this.watchlistController
            .getWatchlist({ mediaType, page: pageIndex, size: PAGE_SIZE, sortDirection })
            .pipe(
                tap((response) =>
                    this.patchState({
                        pageIndex,
                        total: response.totalElements ?? 0,
                        items: remoteSuccess(
                            (response.content ?? [])
                                .map((item) => toSnapshotMediaListItem(item, toRating(item.voteAverage)))
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
