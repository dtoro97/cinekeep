import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import { hasRemoteData, pluralize, remoteData } from '../../../shared';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';

@Injectable()
export class MediaReviewsPageStoreService extends ComponentStore<Record<string, never>> {
    readonly mediaReviews$ = this.select(
        this.mediaStore.mediaDetails$,
        this.mediaReviewsStore.reviewPageState$,
        (media, reviewPage) => {
            const page = remoteData(reviewPage, null);
            const reviews = page?.results ?? [];
            const ratings = reviews
                .map((review) => review.author_details?.rating)
                .filter((rating): rating is number => typeof rating === 'number' && rating > 0);
            const averageRating = ratings.length
                ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
                : null;
            const isLoaded = hasRemoteData(reviewPage);

            return {
                media,
                showSkeleton: reviewPage.state === 'loading',
                showStats: isLoaded,
                hasReviews: isLoaded && reviews.length > 0,
                showEmpty: isLoaded && reviews.length === 0,
                showLoadingMore: reviewPage.state === 'loading-more',
                hasMore: (page?.page ?? 0) < (page?.total_pages ?? 0),
                reviews: reviews.map((review) => ({ review, link: review.id ? [review.id] : null })),
                reviewCount: page?.total_results || reviews.length,
                averageRating,
                ratedCountLabel: `from ${pluralize(ratings.length, 'rating')}`,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaReviewsStore: MediaReviewsStoreService,
    ) {
        super({});
    }

    load$(): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(switchMap((target) => this.mediaReviewsStore.load$(target)));
    }

    loadMore$(): Observable<unknown> {
        return this.mediaReviewsStore.loadMoreReviews$();
    }
}
