import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, map, switchMap, tap, throwError } from 'rxjs';

import { FavoriteControllerService, PageResponseFavoriteItemResponse } from '../../api-cinekeep';
import { PAGE_SIZE } from '../../constants';
import {
    CardItem,
    RemoteData,
    MediaType,
    SortDirection,
    UserLibraryService,
    isDefined,
    toSnapshotCardItem,
    toRating,
} from '../../shared';
import { remoteSuccess } from '../../shared/utils';
import { toTotalAfterMediaRemoval, toUserMediaTotalLabel } from './user-account-media.helpers';
import {
    DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
} from './user-list-sort-options';

interface UserFavouritesState {
    readonly pageItems: RemoteData<CardItem[]>;
    readonly mediaType: MediaType;
    readonly page: number;
    readonly pageTotalResults: number;
    readonly sortDirection: SortDirection;
}

interface UserFavouritesPageChanges {
    readonly mediaType?: MediaType;
    readonly sortDirection?: SortDirection;
}

const INITIAL_PAGE = 1;

const INITIAL_STATE: UserFavouritesState = {
    pageItems: { state: 'notAsked' },
    mediaType: 'movie',
    page: INITIAL_PAGE,
    pageTotalResults: 0,
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
};

@Injectable()
export class UserFavouritesStore extends ComponentStore<UserFavouritesState> {
    readonly favouritesPageViewModel$ = this.select((state) => ({
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
        private readonly favoriteController: FavoriteControllerService,
        private readonly userLibraryService: UserLibraryService,
    ) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number, changes: UserFavouritesPageChanges = {}) {
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

        return this.fetchFavouritePage$(mediaType, page, sortDirection).pipe(
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

    removeFromFavourites$(item: CardItem) {
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
            .updateFavorite$(item.id, item.mediaType, false)
            .pipe(
                switchMap(() => this.loadPage$(nextPage - 1)),
                catchError((error: unknown) => {
                    this.setState(previousState);
                    return throwError(() => error);
                }),
            );
    }

    private fetchFavouritePage$(mediaType: MediaType, page: number, sortDirection: SortDirection) {
        return this.favoriteController
            .getFavorites({ mediaType, page: page - 1, size: PAGE_SIZE, sortDirection })
            .pipe(map((result) => this.toFavouritePage(result, page)));
    }

    private toFavouritePage(result: PageResponseFavoriteItemResponse, requestedPage: number) {
        return {
            items: (result.content ?? []).map((item) => toSnapshotCardItem(item, toRating(item.voteAverage))).filter(isDefined),
            page: requestedPage,
            totalResults: result.totalElements ?? 0,
        };
    }

    private toValidPage(page: number, totalResults: number): number {
        const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

        return Math.min(page, totalPages);
    }
}
