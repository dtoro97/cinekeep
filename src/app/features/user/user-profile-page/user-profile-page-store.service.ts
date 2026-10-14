import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, forkJoin, map, merge, of, tap } from 'rxjs';

import {
    EpisodeRatingControllerService,
    FavoriteControllerService,
    RatingControllerService,
    UserListControllerService,
    WatchlistControllerService,
} from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    CardItem,
    LocaleStoreService,
    RemoteData,
    UserSessionStoreService,
    formatEpisodeCode,
    isDefined,
    mapRemoteData,
    pluralize,
    remoteData,
    remoteSuccess,
    toRating,
    toSnapshotCardItem,
} from '../../../shared';
import { DEFAULT_USER_ACCOUNT_SORT_DIRECTION } from '../user-list-sort-options';
import { UserListSummaryItem, toUserListSummaryItem } from '../user-list-summary.mapper';

type UserProfileShelf = 'favourites' | 'watchlist' | 'ratings';

interface UserProfilePreview<T> {
    readonly items: T[];
    readonly total: number;
}

type UserProfilePageState = Record<UserProfileShelf, RemoteData<UserProfilePreview<CardItem>>> & {
    readonly lists: RemoteData<UserProfilePreview<UserListSummaryItem>>;
};

const LOADING_STATE: UserProfilePageState = {
    favourites: { state: 'loading' },
    watchlist: { state: 'loading' },
    ratings: { state: 'loading' },
    lists: { state: 'loading' },
};

const FIRST_PAGE = { page: 0, size: PAGE_SIZE, sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION };
const LIST_PREVIEW_COUNT = 3;
const EMPTY_PREVIEW = { items: [], total: 0 };

// Favourites are the profile's identity, shown larger; the other shelves stay dense.
const SHELVES = [
    {
        key: 'favourites',
        titleId: 'profile-favourites-title',
        title: 'Favorites',
        ariaLabel: 'Favorites preview',
        link: '/me/favorites',
        linkLabel: 'View favorites',
        columns: 5,
        imageParams: 'w342',
        emptyIconClass: 'fa-regular fa-heart',
        emptyTitle: 'No favorite titles',
        emptyText: 'Movies and TV series you mark as favorites will appear here.',
    },
    {
        key: 'watchlist',
        titleId: 'profile-watchlist-title',
        title: 'Watchlist',
        ariaLabel: 'Watchlist preview',
        link: '/me/watchlists',
        linkLabel: 'View watchlist',
        columns: 7,
        imageParams: 'w185',
        emptyIconClass: 'fa-regular fa-bookmark',
        emptyTitle: 'No watchlist titles',
        emptyText: 'Movies and TV series you add to your watchlist will appear here.',
    },
    {
        key: 'ratings',
        titleId: 'profile-ratings-title',
        title: 'Ratings',
        ariaLabel: 'Ratings preview',
        link: '/me/ratings',
        linkLabel: 'View ratings',
        columns: 7,
        imageParams: 'w185',
        emptyIconClass: 'fa-regular fa-star',
        emptyTitle: 'No rated titles',
        emptyText: 'Movies and TV series you rate will appear here.',
    },
] as const;

@Injectable()
export class UserProfilePageStoreService extends ComponentStore<UserProfilePageState> {
    readonly userProfile$ = this.select(
        this.state$,
        this.userSessionStore.user$,
        this.localeStore.locale$,
        (state, user, { language, region }) => {
            const totals = {
                favourites: remoteData(state.favourites, EMPTY_PREVIEW).total,
                watchlist: remoteData(state.watchlist, EMPTY_PREVIEW).total,
                ratings: remoteData(state.ratings, EMPTY_PREVIEW).total,
                lists: remoteData(state.lists, EMPTY_PREVIEW).total,
            };
            const lists = remoteData(state.lists, EMPTY_PREVIEW).items;
            const profileMeta = [
                language ? `Language ${language.toUpperCase()}` : null,
                region ? `Region ${region.toUpperCase()}` : null,
            ].filter(isDefined);

            return {
                username: user?.username ?? null,
                displayName: user?.username ?? 'Member',
                profileMeta,
                hasProfileMeta: profileMeta.length > 0,
                stats: [
                    { label: 'Watchlist', link: '/me/watchlists', total: totals.watchlist },
                    { label: 'Ratings', link: '/me/ratings', total: totals.ratings },
                    { label: 'Favorites', link: '/me/favorites', total: totals.favourites },
                    { label: 'Lists', link: '/me/lists', total: totals.lists },
                ],
                shelves: SHELVES.map((shelf) => {
                    const preview = state[shelf.key];

                    return {
                        ...shelf,
                        countLabel: pluralize(totals[shelf.key], 'title'),
                        items: mapRemoteData(preview, ({ items }) => items),
                        showEmpty: preview.state === 'success' && preview.data.items.length === 0,
                    };
                }),
                listCountLabel: pluralize(totals.lists, 'list'),
                lists,
                showListSkeleton: state.lists.state === 'loading',
                hasLists: lists.length > 0,
                showListEmpty: state.lists.state === 'success' && lists.length === 0,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly episodeRatingController: EpisodeRatingControllerService,
        private readonly favoriteController: FavoriteControllerService,
        private readonly ratingController: RatingControllerService,
        private readonly userListController: UserListControllerService,
        private readonly watchlistController: WatchlistControllerService,
        private readonly userSessionStore: UserSessionStoreService,
        private readonly localeStore: LocaleStoreService,
    ) {
        super(LOADING_STATE);
    }

    // Each section fails soft to empty, so one failed request leaves the rest of the profile intact.
    load$(): Observable<unknown> {
        return merge(
            this.favoriteController.getFavorites(FIRST_PAGE).pipe(
                map((response) => ({
                    items: (response.content ?? [])
                        .map((item) => toSnapshotCardItem(item, toRating(item.voteAverage)))
                        .filter(isDefined),
                    total: response.totalElements ?? 0,
                })),
                catchError(() => of(EMPTY_PREVIEW)),
                tap((favourites) => this.patchState({ favourites: remoteSuccess(favourites) })),
            ),
            this.watchlistController.getWatchlist(FIRST_PAGE).pipe(
                map((response) => ({
                    items: (response.content ?? [])
                        .map((item) => toSnapshotCardItem(item, toRating(item.voteAverage)))
                        .filter(isDefined),
                    total: response.totalElements ?? 0,
                })),
                catchError(() => of(EMPTY_PREVIEW)),
                tap((watchlist) => this.patchState({ watchlist: remoteSuccess(watchlist) })),
            ),
            // Rated titles and rated episodes share one shelf.
            forkJoin({
                titles: this.ratingController.getRatings(FIRST_PAGE),
                episodes: this.episodeRatingController.getEpisodeRatings(FIRST_PAGE),
            }).pipe(
                map(({ titles, episodes }) => ({
                    items: [
                        ...(titles.content ?? [])
                            .map((item) => toSnapshotCardItem(item, item.value ?? null))
                            .filter(isDefined),
                        ...(episodes.content ?? [])
                            .map(({ seriesTmdbId, seasonNumber, episodeNumber, ...rating }): CardItem | null =>
                                // A rating without these ids cannot link to its episode.
                                seriesTmdbId == null || seasonNumber == null || episodeNumber == null
                                    ? null
                                    : {
                                          id: seriesTmdbId,
                                          mediaType: 'tv',
                                          title: rating.episodeName?.trim() || 'Untitled episode',
                                          imagePath: rating.stillPath ?? null,
                                          backdropPath: null,
                                          rating: rating.value ?? null,
                                          date: rating.airDate ?? '',
                                          overview: '',
                                          role: formatEpisodeCode(seasonNumber, episodeNumber),
                                          routeCommands: [
                                              '/title',
                                              seriesTmdbId,
                                              'tv',
                                              'episodes',
                                              seasonNumber,
                                              episodeNumber,
                                          ],
                                      },
                            )
                            .filter(isDefined),
                    ],
                    total: (titles.totalElements ?? 0) + (episodes.totalElements ?? 0),
                })),
                catchError(() => of(EMPTY_PREVIEW)),
                tap((ratings) => this.patchState({ ratings: remoteSuccess(ratings) })),
            ),
            this.userListController.getLists({ page: 0, size: LIST_PREVIEW_COUNT }).pipe(
                map((response) => ({
                    items: (response.content ?? []).map(toUserListSummaryItem).filter(isDefined),
                    total: response.totalElements ?? 0,
                })),
                catchError(() => of(EMPTY_PREVIEW)),
                tap((lists) => this.patchState({ lists: remoteSuccess(lists) })),
            ),
        );
    }
}
