import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { forkJoin, of, switchMap, tap } from 'rxjs';

import { PAGE_SIZE } from '../../../constants';
import { RemoteData, VideoTrailerSeedItem } from '../../../shared';
import {
    TrailerDataService,
    TrailerFeedType,
    TrailerVideoCardItem,
} from '../trailer-data.service';

interface TrailersFeedState {
    readonly trailers: RemoteData<TrailerVideoCardItem[]>;
    readonly pendingSeeds: readonly VideoTrailerSeedItem[];
}

interface TrailersPageState {
    readonly selectedFeed: TrailerFeedType;
    readonly featuredTrailer: RemoteData<TrailerVideoCardItem | null>;
    readonly feeds: Record<TrailerFeedType, TrailersFeedState>;
}

const INITIAL_STATE: TrailersPageState = {
    selectedFeed: 'trending',
    featuredTrailer: { state: 'notAsked' },
    feeds: {
        trending: {
            trailers: { state: 'notAsked' },
            pendingSeeds: [],
        },
        new: {
            trailers: { state: 'notAsked' },
            pendingSeeds: [],
        },
    },
};

@Injectable()
export class TrailersPageStoreService extends ComponentStore<TrailersPageState> {
    readonly vm$ = this.select((state) => {
        const feed = state.feeds[state.selectedFeed];
        const items =
            feed.trailers.state === 'success' || feed.trailers.state === 'loading-more' ? feed.trailers.data : [];

        const featured = state.featuredTrailer.state === 'success' ? state.featuredTrailer.data : null;

        return {
            selectedFeed: state.selectedFeed,
            trailersState: feed.trailers,
            featuredSpotlight: featured
                ? {
                      spotlight: {
                          id: featured.mediaId,
                          mediaType: featured.mediaType,
                          title: featured.mediaTitle,
                          overview: featured.mediaOverview ?? '',
                          backdropPath: featured.backdropPath ?? null,
                          rating: null,
                          year: featured.mediaYear ?? '',
                          mediaTypeLabel: '',
                      },
                      videoUrl: featured.videoUrl,
                  }
                : null,
            showMore: feed.pendingSeeds.length > 0,
        };
    });

    constructor(private readonly trailerData: TrailerDataService) {
        super(INITIAL_STATE);
    }

    load$(feedType: TrailerFeedType = 'trending') {
        this.patchState({ selectedFeed: feedType });

        return forkJoin([
            this.loadFeaturedTrailer$(),
            this.loadFeed$(feedType),
        ]);
    }

    private loadFeaturedTrailer$() {
        const { featuredTrailer } = this.get();

        if (this.hasLoadedOrLoadingValue(featuredTrailer)) {
            return of([]);
        }

        this.patchState({
            featuredTrailer: { state: 'loading' },
        });

        return this.trailerData.getTrailerSeeds$('trending').pipe(
            switchMap((trailerSeeds) =>
                this.trailerData.loadVideoCardsForSeeds$(trailerSeeds.slice(0, 1)),
            ),
            tap((trailers) => {
                this.patchState({
                    featuredTrailer: {
                        state: 'success',
                        data: trailers[0] ?? null,
                    },
                });
            }),
        );
    }

    private loadFeed$(feedType: TrailerFeedType) {
        const feed = this.get().feeds[feedType];

        if (this.hasLoadedOrLoading(feed.trailers)) {
            return of([]);
        }

        this.patchFeedState(feedType, {
            trailers: { state: 'loading' },
            pendingSeeds: [],
        });

        return this.trailerData.getTrailerSeeds$(feedType).pipe(
            switchMap((trailerSeeds) => {
                const initialSeeds = trailerSeeds.slice(0, PAGE_SIZE);

                return this.trailerData.loadVideoCardsForSeeds$(initialSeeds).pipe(
                    tap((nextTrailers) => {
                        this.patchFeedState(feedType, {
                            trailers: {
                                state: 'success',
                                data: nextTrailers,
                            },
                            pendingSeeds: trailerSeeds.slice(initialSeeds.length),
                        });
                    }),
                );
            }),
        );
    }

    showMoreSelected$() {
        const state = this.get();
        const feedType = state.selectedFeed;
        const feed = state.feeds[feedType];

        if (feed.trailers.state !== 'success' || !feed.pendingSeeds.length) {
            return of([]);
        }

        const nextSeeds = feed.pendingSeeds.slice(0, PAGE_SIZE);
        const remainingSeeds = feed.pendingSeeds.slice(nextSeeds.length);
        const currentTrailers = feed.trailers.data;

        this.patchFeedState(feedType, {
            trailers: {
                state: 'loading-more',
                data: currentTrailers,
            } as RemoteData<TrailerVideoCardItem[]>,
        });

        return this.trailerData.loadVideoCardsForSeeds$(nextSeeds).pipe(
            tap((items) =>
                this.patchFeedState(feedType, {
                    trailers: {
                        state: 'success',
                        data: [...currentTrailers, ...items],
                    } as RemoteData<TrailerVideoCardItem[]>,
                    pendingSeeds: remainingSeeds,
                }),
            ),
        );
    }

    private patchFeedState(feedType: TrailerFeedType, patch: Partial<TrailersFeedState>): void {
        this.patchState((state) => ({
            feeds: {
                ...state.feeds,
                [feedType]: {
                    ...state.feeds[feedType],
                    ...patch,
                },
            },
        }));
    }

    private hasLoadedOrLoading<T>(state: RemoteData<T[]>): boolean {
        return state.state === 'loading' || state.state === 'loading-more' || state.state === 'success';
    }

    private hasLoadedOrLoadingValue<T>(state: RemoteData<T>): boolean {
        return state.state === 'loading' || state.state === 'success';
    }
}
