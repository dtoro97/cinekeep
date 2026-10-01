import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, forkJoin, map, tap, throwError } from 'rxjs';

import {
    EpisodeRatingControllerService,
    EpisodeRatingResponse,
    FavoriteControllerService,
    RatingControllerService,
    WatchlistControllerService,
} from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    CardItem,
    RemoteData,
    formatEpisodeCode,
    isDefined,
    remoteSuccess,
    toSnapshotCardItem,
} from '../../../shared';
import { toRatedEpisodeRef } from '../user-account-media.helpers';
import { DEFAULT_USER_ACCOUNT_SORT_DIRECTION } from '../user-list-sort-options';

export interface UserProfilePreview {
    readonly state: RemoteData<CardItem[]>;
    readonly total: number;
}

type UserProfileSection = 'favourites' | 'watchlist' | 'ratings';

type UserProfilePreviewState = Record<UserProfileSection, UserProfilePreview>;

interface UserProfilePreviewResult {
    readonly items: CardItem[];
    readonly total: number;
}

const EMPTY_PREVIEW: UserProfilePreview = {
    state: { state: 'notAsked' },
    total: 0,
};

const INITIAL_STATE: UserProfilePreviewState = {
    favourites: EMPTY_PREVIEW,
    watchlist: EMPTY_PREVIEW,
    ratings: EMPTY_PREVIEW,
};

const FIRST_PAGE = {
    page: 0,
    size: PAGE_SIZE,
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
};

/** The first page of each library section, shown on the profile overview. */
@Injectable()
export class UserProfilePreviewStore extends ComponentStore<UserProfilePreviewState> {
    readonly favourites$ = this.select((state) => state.favourites);
    readonly watchlist$ = this.select((state) => state.watchlist);
    readonly ratings$ = this.select((state) => state.ratings);

    constructor(
        private readonly episodeRatingController: EpisodeRatingControllerService,
        private readonly favoriteController: FavoriteControllerService,
        private readonly ratingController: RatingControllerService,
        private readonly watchlistController: WatchlistControllerService,
    ) {
        super(INITIAL_STATE);
    }

    loadFavourites$(): Observable<UserProfilePreviewResult> {
        return this.loadSection$(
            'favourites',
            this.favoriteController.getFavorites(FIRST_PAGE).pipe(
                map((result) => ({
                    items: (result.content ?? [])
                        .map((item) => toSnapshotCardItem(item, item.voteAverage ?? null))
                        .filter(isDefined),
                    total: result.totalElements ?? 0,
                })),
            ),
        );
    }

    loadWatchlist$(): Observable<UserProfilePreviewResult> {
        return this.loadSection$(
            'watchlist',
            this.watchlistController.getWatchlist(FIRST_PAGE).pipe(
                map((result) => ({
                    items: (result.content ?? [])
                        .map((item) => toSnapshotCardItem(item, item.voteAverage ?? null))
                        .filter(isDefined),
                    total: result.totalElements ?? 0,
                })),
            ),
        );
    }

    /** Rated titles and rated episodes share one preview. */
    loadRatings$(): Observable<UserProfilePreviewResult> {
        return this.loadSection$(
            'ratings',
            forkJoin({
                titles: this.ratingController.getRatings(FIRST_PAGE),
                episodes: this.episodeRatingController.getEpisodeRatings(FIRST_PAGE),
            }).pipe(
                map(({ titles, episodes }) => ({
                    items: [
                        ...(titles.content ?? [])
                            .map((item) => toSnapshotCardItem(item, item.value ?? null))
                            .filter(isDefined),
                        ...(episodes.content ?? []).map((item) => toRatedEpisodeCardItem(item)).filter(isDefined),
                    ],
                    total: (titles.totalElements ?? 0) + (episodes.totalElements ?? 0),
                })),
            ),
        );
    }

    /** A failed request restores the section's previous preview and rethrows. */
    private loadSection$(
        section: UserProfileSection,
        request$: Observable<UserProfilePreviewResult>,
    ): Observable<UserProfilePreviewResult> {
        const previous = this.get()[section];

        this.patchSection(section, { ...previous, state: { state: 'loading' } });

        return request$.pipe(
            tap(({ items, total }) => this.patchSection(section, { state: remoteSuccess(items), total })),
            catchError((error: unknown) => {
                this.patchSection(section, previous);
                return throwError(() => error);
            }),
        );
    }

    private patchSection(section: UserProfileSection, preview: UserProfilePreview): void {
        this.setState((state) => {
            const next = { ...state };
            next[section] = preview;
            return next;
        });
    }
}

function toRatedEpisodeCardItem(item: EpisodeRatingResponse): CardItem | null {
    const episode = toRatedEpisodeRef(item);

    if (!episode) {
        return null;
    }

    const { seriesId, seasonNumber, episodeNumber, title } = episode;

    return {
        id: seriesId,
        mediaType: 'tv',
        title,
        imagePath: item.stillPath ?? null,
        backdropPath: null,
        rating: item.value ?? null,
        date: item.airDate ?? '',
        overview: '',
        role: formatEpisodeCode(seasonNumber, episodeNumber),
        routeCommands: ['/title', seriesId, 'tv', 'episodes', seasonNumber, episodeNumber],
    };
}
