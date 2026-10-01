import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';

import {
    EpisodeRatingControllerService,
    EpisodeRatingResponse,
    PageResponseEpisodeRatingResponse,
    PageResponseRatingResponse,
    RatingControllerService,
} from '../../api-cinekeep';
import { PAGE_SIZE } from '../../constants';
import {
    EpisodeSnapshotRequest,
    EpisodeListItemData,
    RemoteData,
    MediaRatingService,
    MediaListItem,
    MediaType,
    SortDirection,
    isDefined,
    pluralize,
    toSnapshotMediaListItem,
} from '../../shared';
import { remoteSuccess, updateRemoteData } from '../../shared/utils';
import { toRatedEpisodeRef, toTotalAfterMediaRemoval } from './user-account-media.helpers';
import {
    DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
} from './user-list-sort-options';

export type UserRatingContentType = MediaType | 'episode';

export interface UserRatedEpisodeItem {
    readonly key: string;
    readonly seriesId: number;
    readonly seasonNumber: number;
    readonly episodeNumber: number;
    readonly title: string;
    readonly rating: number | null;
    readonly item: EpisodeListItemData;
}

type UserRatingsPageResult =
    | {
          readonly contentType: 'episode';
          readonly items: UserRatedEpisodeItem[];
          readonly page: number;
          readonly totalResults: number;
      }
    | {
          readonly contentType: MediaType;
          readonly items: MediaListItem[];
          readonly page: number;
          readonly totalResults: number;
      };

interface UserRatingsState {
    readonly pageItems: RemoteData<MediaListItem[]>;
    readonly episodePageItems: RemoteData<UserRatedEpisodeItem[]>;
    readonly contentType: UserRatingContentType;
    readonly page: number;
    readonly pageTotalResults: number;
    readonly sortDirection: SortDirection;
}

interface UserRatingsPageChanges {
    readonly contentType?: UserRatingContentType;
    readonly sortDirection?: SortDirection;
}

const INITIAL_PAGE = 1;

const INITIAL_STATE: UserRatingsState = {
    pageItems: { state: 'notAsked' },
    episodePageItems: { state: 'notAsked' },
    contentType: 'movie',
    page: INITIAL_PAGE,
    pageTotalResults: 0,
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
};

@Injectable()
export class UserRatingsStore extends ComponentStore<UserRatingsState> {
    readonly ratingsPageViewModel$ = this.select((state) => ({
        contentType: state.contentType,
        mediaItems: state.pageItems,
        episodeItems: state.episodePageItems,
        itemsState:
            state.contentType === 'episode'
                ? state.episodePageItems.state
                : state.pageItems.state,
        page: state.page - 1,
        pageSize: PAGE_SIZE,
        sortDirection: state.sortDirection,
        total: state.pageTotalResults,
        emptyState: this.toEmptyState(state.contentType),
        totalLabel: this.toTotalLabel(state.contentType, state.pageTotalResults),
    }));

    constructor(
        private readonly episodeRatingController: EpisodeRatingControllerService,
        private readonly mediaRatingService: MediaRatingService,
        private readonly ratingController: RatingControllerService,
    ) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number, changes: UserRatingsPageChanges = {}) {
        const previousState = this.get();
        const page = pageIndex + 1;
        const contentType = changes.contentType ?? previousState.contentType;
        const sortDirection =
            changes.sortDirection ?? previousState.sortDirection;

        this.patchState({
            contentType,
            page,
            sortDirection,
        });

        if (contentType === 'episode') {
            this.patchState({ episodePageItems: { state: 'loading' } });
        } else {
            this.patchState({ pageItems: { state: 'loading' } });
        }

        return this.fetchRatingsPage$(contentType, page, sortDirection).pipe(
            tap((result) => {
                if (result.contentType === 'episode') {
                    this.patchState({
                        episodePageItems: remoteSuccess(result.items),
                        page: result.page,
                        pageTotalResults: result.totalResults,
                    });
                    return;
                }

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

    setContentType$(contentType: UserRatingContentType) {
        if (this.get().contentType === contentType) {
            return EMPTY;
        }

        return this.loadPage$(0, { contentType });
    }

    toggleSortDirection$() {
        return this.loadPage$(0, {
            sortDirection: this.get().sortDirection === 'asc' ? 'desc' : 'asc',
        });
    }

    removeMediaRating$(item: MediaListItem) {
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

        return this.mediaRatingService
            .deleteMediaRating$(item.id, item.mediaType)
            .pipe(
                switchMap(() => this.loadPage$(nextPage - 1)),
                catchError((error: unknown) => {
                    this.setState(previousState);
                    return throwError(() => error);
                }),
            );
    }

    /** CineKeep keeps stored snapshot fields that are not sent, so the title alone is enough. */
    updateMediaRating$(item: MediaListItem, value: number) {
        return this.mediaRatingService.rateMedia$(item.id, item.mediaType, value, { title: item.title }).pipe(
            tap(() => this.patchRatedMediaItemRating(item, value)),
        );
    }

    removeEpisodeRating$(item: UserRatedEpisodeItem) {
        const previousState = this.get();
        const optimisticTotal = this.toTotalAfterEpisodeRemoval(
            previousState,
            item,
        );
        const nextPage = this.toValidPage(previousState.page, optimisticTotal);

        this.patchState({
            page: nextPage,
            episodePageItems: { state: 'loading' },
            pageTotalResults: optimisticTotal,
        });

        return this.mediaRatingService
            .deleteEpisodeRating$(
                item.seriesId,
                item.seasonNumber,
                item.episodeNumber,
            )
            .pipe(
                switchMap(() => this.loadPage$(nextPage - 1)),
                catchError((error: unknown) => {
                    this.setState(previousState);
                    return throwError(() => error);
                }),
            );
    }

    updateEpisodeRating$(item: UserRatedEpisodeItem, value: number) {
        return this.mediaRatingService
            .rateEpisode$(
                item.seriesId,
                item.seasonNumber,
                item.episodeNumber,
                value,
                this.toEpisodeSnapshot(item),
            )
            .pipe(tap(() => this.patchRatedEpisodeItemRating(item, value)));
    }

    private fetchRatingsPage$(
        contentType: UserRatingContentType,
        page: number,
        sortDirection: SortDirection,
    ): Observable<UserRatingsPageResult> {
        if (contentType === 'episode') {
            return this.episodeRatingController
                .getEpisodeRatings({ page: page - 1, size: PAGE_SIZE, sortDirection })
                .pipe(map((result) => this.toEpisodeRatingsPage(result, page)));
        }

        return this.ratingController
            .getRatings({ mediaType: contentType, page: page - 1, size: PAGE_SIZE, sortDirection })
            .pipe(map((result) => this.toMediaRatingsPage(result, contentType, page)));
    }

    private toEpisodeRatingsPage(
        result: PageResponseEpisodeRatingResponse,
        requestedPage: number,
    ): UserRatingsPageResult {
        return {
            contentType: 'episode',
            items: (result.content ?? []).map((item) => this.toRatedEpisodeItem(item)).filter(isDefined),
            page: requestedPage,
            totalResults: result.totalElements ?? 0,
        };
    }

    private toMediaRatingsPage(
        result: PageResponseRatingResponse,
        contentType: MediaType,
        requestedPage: number,
    ): UserRatingsPageResult {
        return {
            contentType,
            items: (result.content ?? []).map((item) => toSnapshotMediaListItem(item, item.value ?? null)).filter(isDefined),
            page: requestedPage,
            totalResults: result.totalElements ?? 0,
        };
    }

    private toRatedEpisodeItem(item: EpisodeRatingResponse): UserRatedEpisodeItem | null {
        const episode = toRatedEpisodeRef(item);

        if (!episode) {
            return null;
        }

        const { seriesId, seasonNumber, episodeNumber, title } = episode;

        return {
            key: `${seriesId}-${seasonNumber}-${episodeNumber}`,
            seriesId,
            seasonNumber,
            episodeNumber,
            title,
            rating: item.value ?? null,
            item: {
                name: title,
                subtitle: item.seriesTitle?.trim() || null,
                overview: '',
                stillPath: item.stillPath ?? null,
                seasonNumber,
                episodeNumber,
                airDate: item.airDate ?? null,
                runtime: null,
                voteAverage: item.value ?? null,
                routeCommands: ['/title', seriesId, 'tv', 'episodes', seasonNumber, episodeNumber],
            },
        };
    }

    /**
     * A rating update overwrites the episode fields, so they are re-sent as stored. The series
     * only needs its title; without one, the snapshot is fetched from TMDb instead.
     */
    private toEpisodeSnapshot(item: UserRatedEpisodeItem): EpisodeSnapshotRequest | undefined {
        const seriesTitle = item.item.subtitle;

        if (!seriesTitle) {
            return undefined;
        }

        return {
            episodeName: item.title,
            stillPath: item.item.stillPath ?? undefined,
            airDate: item.item.airDate ?? undefined,
            series: { title: seriesTitle },
        };
    }

    private toTotalLabel(
        contentType: UserRatingContentType,
        totalResults: number,
    ): string {
        if (contentType === 'episode') {
            return pluralize(totalResults, 'episode rating');
        }

        if (contentType === 'tv') {
            return pluralize(totalResults, 'TV series rating');
        }

        return pluralize(totalResults, 'movie rating');
    }

    private toEmptyState(contentType: UserRatingContentType) {
        if (contentType === 'episode') {
            return {
                iconClass: 'fa-regular fa-star',
                title: 'No rated episodes',
                text: 'TV episodes you rate will appear here.',
            };
        }

        if (contentType === 'tv') {
            return {
                iconClass: 'fa-regular fa-star',
                title: 'No rated TV series',
                text: 'TV series you rate will appear here.',
            };
        }

        return {
            iconClass: 'fa-regular fa-star',
            title: 'No rated movies',
            text: 'Movies you rate will appear here.',
        };
    }

    private toTotalAfterEpisodeRemoval(
        state: UserRatingsState,
        item: UserRatedEpisodeItem,
    ): number {
        const itemWasLoaded =
            state.episodePageItems.state === 'success' &&
            state.episodePageItems.data.some(
                (pageItem) => pageItem.key === item.key,
            );

        return itemWasLoaded
            ? Math.max(0, state.pageTotalResults - 1)
            : state.pageTotalResults;
    }

    private toValidPage(page: number, totalResults: number): number {
        const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

        return Math.min(page, totalPages);
    }

    private patchRatedMediaItemRating(item: MediaListItem, value: number): void {
        this.patchState((state) => ({
            pageItems: updateRemoteData(state.pageItems, (items) =>
                items.map((pageItem) =>
                    pageItem.id === item.id && pageItem.mediaType === item.mediaType
                        ? { ...pageItem, rating: value }
                        : pageItem,
                ),
            ),
        }));
    }

    private patchRatedEpisodeItemRating(item: UserRatedEpisodeItem, value: number): void {
        this.patchState((state) => ({
            episodePageItems: updateRemoteData(state.episodePageItems, (items) =>
                items.map((pageItem) =>
                    pageItem.key === item.key
                        ? { ...pageItem, rating: value, item: { ...pageItem.item, voteAverage: value } }
                        : pageItem,
                ),
            ),
        }));
    }
}
