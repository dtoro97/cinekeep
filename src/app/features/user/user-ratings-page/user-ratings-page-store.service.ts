import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';

import { EpisodeRatingControllerService, RatingControllerService } from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    EpisodeListItemData,
    MediaListItem,
    MediaRatingService,
    MediaType,
    RemoteData,
    SortDirection,
    formatEpisodeCode,
    isDefined,
    pluralize,
    remoteData,
    remoteSuccess,
    toSnapshotMediaListItem,
    updateRemoteData,
} from '../../../shared';
import { DEFAULT_USER_ACCOUNT_SORT_DIRECTION } from '../user-list-sort-options';

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

interface UserRatingsPage {
    readonly titles: MediaListItem[];
    readonly episodes: UserRatedEpisodeItem[];
}

interface UserRatingsPageState {
    readonly contentType: UserRatingContentType;
    readonly sortDirection: SortDirection;
    readonly pageIndex: number;
    readonly total: number;
    readonly ratings: RemoteData<UserRatingsPage>;
}

const INITIAL_STATE: UserRatingsPageState = {
    contentType: 'movie',
    sortDirection: DEFAULT_USER_ACCOUNT_SORT_DIRECTION,
    pageIndex: 0,
    total: 0,
    ratings: { state: 'notAsked' },
};

const EMPTY_PAGE: UserRatingsPage = { titles: [], episodes: [] };

const CONTENT_TYPE_COPY: Record<UserRatingContentType, { totalNoun: string; emptyTitle: string; emptyText: string }> = {
    movie: {
        totalNoun: 'movie rating',
        emptyTitle: 'No rated movies',
        emptyText: 'Movies you rate will appear here.',
    },
    tv: {
        totalNoun: 'TV series rating',
        emptyTitle: 'No rated TV series',
        emptyText: 'TV series you rate will appear here.',
    },
    episode: {
        totalNoun: 'episode rating',
        emptyTitle: 'No rated episodes',
        emptyText: 'TV episodes you rate will appear here.',
    },
};

@Injectable()
export class UserRatingsPageStoreService extends ComponentStore<UserRatingsPageState> {
    readonly ratings$ = this.select(({ contentType, sortDirection, pageIndex, total, ratings }) => {
        const { titles, episodes } = remoteData(ratings, EMPTY_PAGE);
        const { totalNoun, emptyTitle, emptyText } = CONTENT_TYPE_COPY[contentType];
        const isLoading = ratings.state === 'loading';
        const isLoaded = ratings.state === 'success';
        const hasItems = titles.length > 0 || episodes.length > 0;

        return {
            contentType,
            sortDirection,
            pageIndex,
            pageSize: PAGE_SIZE,
            total,
            totalLabel: pluralize(total, totalNoun),
            emptyTitle,
            emptyText,
            titles,
            episodes,
            showTitleSkeleton: isLoading && contentType !== 'episode',
            showEpisodeSkeleton: isLoading && contentType === 'episode',
            showTotal: isLoaded,
            hasTitles: titles.length > 0,
            hasEpisodes: episodes.length > 0,
            showEmpty: isLoaded && !hasItems,
            showPaginator: hasItems && total > PAGE_SIZE,
        };
    });

    constructor(
        private readonly episodeRatingController: EpisodeRatingControllerService,
        private readonly mediaRatingService: MediaRatingService,
        private readonly ratingController: RatingControllerService,
    ) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number): Observable<unknown> {
        this.patchState({ pageIndex, ratings: { state: 'loading' } });

        return this.fetchPage$(pageIndex);
    }

    setContentType$(contentType: UserRatingContentType): Observable<unknown> {
        if (contentType === this.get().contentType) {
            return EMPTY;
        }

        this.patchState({ contentType });

        return this.loadPage$(0);
    }

    toggleSortDirection$(): Observable<unknown> {
        this.patchState(({ sortDirection }) => ({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' }));

        return this.loadPage$(0);
    }

    // CineKeep keeps the stored snapshot fields that are not sent, so the title alone is enough.
    updateTitleRating$(item: MediaListItem, value: number): Observable<unknown> {
        return this.mediaRatingService.rateMedia$(item.id, item.mediaType, value, { title: item.title }).pipe(
            tap(() =>
                this.patchState((state) => ({
                    ratings: updateRemoteData(state.ratings, (page) => ({
                        ...page,
                        titles: page.titles.map((title) =>
                            title.id === item.id ? { ...title, rating: value } : title,
                        ),
                    })),
                })),
            ),
        );
    }

    removeTitleRating$(item: MediaListItem): Observable<unknown> {
        return this.ratingController
            .deleteRating({ mediaType: item.mediaType, tmdbId: item.id })
            .pipe(switchMap(() => this.reloadAfterRemoval$()));
    }

    updateEpisodeRating$(episode: UserRatedEpisodeItem, value: number): Observable<unknown> {
        const seriesTitle = episode.item.subtitle;

        return this.mediaRatingService
            .rateEpisode$(
                episode.seriesId,
                episode.seasonNumber,
                episode.episodeNumber,
                value,
                // A rating update overwrites the episode fields, so they are re-sent as stored. Without a
                // series title the snapshot is fetched from TMDb instead.
                seriesTitle
                    ? {
                          episodeName: episode.title,
                          stillPath: episode.item.stillPath ?? undefined,
                          airDate: episode.item.airDate ?? undefined,
                          series: { title: seriesTitle },
                      }
                    : undefined,
            )
            .pipe(
                tap(() =>
                    this.patchState((state) => ({
                        ratings: updateRemoteData(state.ratings, (page) => ({
                            ...page,
                            episodes: page.episodes.map((rated) =>
                                rated.key === episode.key
                                    ? { ...rated, rating: value, item: { ...rated.item, voteAverage: value } }
                                    : rated,
                            ),
                        })),
                    })),
                ),
            );
    }

    removeEpisodeRating$(episode: UserRatedEpisodeItem): Observable<unknown> {
        return this.episodeRatingController
            .deleteEpisodeRating({
                seriesTmdbId: episode.seriesId,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.episodeNumber,
            })
            .pipe(switchMap(() => this.reloadAfterRemoval$()));
    }

    private reloadAfterRemoval$(): Observable<unknown> {
        const { pageIndex, ratings } = this.get();
        const { titles, episodes } = remoteData(ratings, EMPTY_PAGE);

        // Removing the last rating of a page moves back to the previous one.
        return this.fetchPage$(titles.length + episodes.length === 1 ? Math.max(0, pageIndex - 1) : pageIndex);
    }

    private fetchPage$(pageIndex: number): Observable<unknown> {
        const { contentType, sortDirection } = this.get();
        const request = { page: pageIndex, size: PAGE_SIZE, sortDirection };
        const page$: Observable<{ total: number; page: UserRatingsPage }> =
            contentType === 'episode'
                ? this.episodeRatingController.getEpisodeRatings(request).pipe(
                      map((response) => ({
                          total: response.totalElements ?? 0,
                          page: {
                              titles: [],
                              episodes: (response.content ?? [])
                                  .map(({ seriesTmdbId, seasonNumber, episodeNumber, ...rating }) => {
                                      // A rating without these ids cannot link to its episode.
                                      if (seriesTmdbId == null || seasonNumber == null || episodeNumber == null) {
                                          return null;
                                      }

                                      const title = rating.episodeName?.trim() || 'Untitled episode';

                                      return {
                                          key: `${seriesTmdbId}-${seasonNumber}-${episodeNumber}`,
                                          seriesId: seriesTmdbId,
                                          seasonNumber,
                                          episodeNumber,
                                          title,
                                          rating: rating.value ?? null,
                                          item: {
                                              name: title,
                                              subtitle: rating.seriesTitle?.trim() || null,
                                              overview: '',
                                              stillPath: rating.stillPath ?? null,
                                              code: formatEpisodeCode(seasonNumber, episodeNumber),
                                              episodeNumber,
                                              airDate: rating.airDate ?? null,
                                              runtime: null,
                                              voteAverage: rating.value ?? null,
                                              routeCommands: [
                                                  '/title',
                                                  seriesTmdbId,
                                                  'tv',
                                                  'episodes',
                                                  seasonNumber,
                                                  episodeNumber,
                                              ],
                                          },
                                      };
                                  })
                                  .filter(isDefined),
                          },
                      })),
                  )
                : this.ratingController.getRatings({ ...request, mediaType: contentType }).pipe(
                      map((response) => ({
                          total: response.totalElements ?? 0,
                          page: {
                              titles: (response.content ?? [])
                                  .map((rating) => toSnapshotMediaListItem(rating, rating.value ?? null))
                                  .filter(isDefined),
                              episodes: [],
                          },
                      })),
                  );

        return page$.pipe(
            tap(({ total, page }) => this.patchState({ pageIndex, total, ratings: remoteSuccess(page) })),
            catchError((error: unknown) => {
                this.patchState({ ratings: { state: 'failure', error } });
                return throwError(() => error);
            }),
        );
    }
}
