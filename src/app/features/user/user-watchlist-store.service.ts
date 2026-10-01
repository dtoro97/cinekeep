import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, map, switchMap, tap, throwError } from 'rxjs';

import { PageResponseWatchlistItemResponse, WatchlistControllerService } from '../../api-cinekeep';
import { PAGE_SIZE } from '../../constants';
import {
    RemoteData,
    MediaListItem,
    MediaType,
    SortDirection,
    UserLibraryService,
    isDefined,
    toSnapshotMediaListItem,
} from '../../shared';
import { remoteSuccess } from '../../shared/utils';
import { toTotalAfterMediaRemoval, toUserMediaTotalLabel } from './user-account-media.helpers';
import {
    DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
} from './user-list-sort-options';

interface UserWatchlistState {
    readonly pageItems: RemoteData<MediaListItem[]>;
    readonly mediaType: MediaType;
    readonly page: number;
    readonly pageTotalResults: number;
    readonly sortDirection: SortDirection;
}

interface UserWatchlistPageChanges {
    readonly mediaType?: MediaType;
    readonly sortDirection?: SortDirection;
}

const INITIAL_PAGE = 1;

const INITIAL_STATE: UserWatchlistState = {
    pageItems: { state: 'notAsked' },
    mediaType: 'movie',
    page: INITIAL_PAGE,
    pageTotalResults: 0,
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
};

@Injectable()
export class UserWatchlistStore extends ComponentStore<UserWatchlistState> {
    readonly watchlistPageViewModel$ = this.select((state) => ({
        mediaType: state.mediaType,
        items: state.pageItems,
        page: state.page - 1,
        pageSize: PAGE_SIZE,
        sortDirection: state.sortDirection,
        total: state.pageTotalResults,
        totalLabel: toUserMediaTotalLabel(
            state.mediaType,
            state.pageTotalResults,
        ),
    }));

    constructor(
        private readonly userLibraryService: UserLibraryService,
        private readonly watchlistController: WatchlistControllerService,
    ) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number, changes: UserWatchlistPageChanges = {}) {
        const previousState = this.get();
        const page = pageIndex + 1;
        const mediaType = changes.mediaType ?? previousState.mediaType;
        const sortDirection =
            changes.sortDirection ?? previousState.sortDirection;

        this.patchState({
            mediaType,
            page,
            pageItems: { state: 'loading' },
            sortDirection,
        });

        return this.fetchWatchlistPage$(mediaType, page, sortDirection).pipe(
            tap((result) => {
                this.patchState({
                    pageItems: remoteSuccess(result.items),
                    page: result.page,
                    pageTotalResults: result.totalResults,
                });
            }),
            catchError((error: unknown) => {
                this.setState(previousState);
                return throwError(() => error);
            }),
        );
    }

    setMediaType$(mediaType: MediaType) {
        if (this.get().mediaType === mediaType) {
            return EMPTY;
        }

        return this.loadPage$(0, { mediaType });
    }

    toggleSortDirection$() {
        return this.loadPage$(0, {
            sortDirection: this.get().sortDirection === 'asc' ? 'desc' : 'asc',
        });
    }

    removeFromWatchlist$(item: MediaListItem) {
        const previousState = this.get();
        const optimisticTotal = toTotalAfterMediaRemoval(
            previousState.pageItems,
            item,
            previousState.pageTotalResults,
        );
        const nextPage = this.toValidPage(previousState.page, optimisticTotal);

        this.patchState({
            page: nextPage,
            pageItems: { state: 'loading' },
            pageTotalResults: optimisticTotal,
        });

        return this.userLibraryService
            .updateWatchlist$(item.id, item.mediaType, false)
            .pipe(
                switchMap(() => this.loadPage$(nextPage - 1)),
                catchError((error: unknown) => {
                    this.setState(previousState);
                    return throwError(() => error);
                }),
            );
    }

    private fetchWatchlistPage$(mediaType: MediaType, page: number, sortDirection: SortDirection) {
        return this.watchlistController
            .getWatchlist({ mediaType, page: page - 1, size: PAGE_SIZE, sortDirection })
            .pipe(map((result) => this.toWatchlistPage(result, page)));
    }

    private toWatchlistPage(result: PageResponseWatchlistItemResponse, requestedPage: number) {
        return {
            items: (result.content ?? []).map((item) => toSnapshotMediaListItem(item, item.voteAverage ?? null)).filter(isDefined),
            page: requestedPage,
            totalResults: result.totalElements ?? 0,
        };
    }

    private toValidPage(page: number, totalResults: number): number {
        const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

        return Math.min(page, totalPages);
    }
}
