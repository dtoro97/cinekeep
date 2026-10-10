import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import { hasRemoteData, pluralize, remoteData } from '../../../shared';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';

interface MediaReviewsPageState {
    /** The score band the list is narrowed to, or `null` for every review. */
    readonly band: string | null;
}

// TMDb scores run 1 to 10; two-point bands keep the spread readable with a few dozen reviews.
const SCORE_BANDS: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly min: number;
    readonly max: number;
}> = [
    { id: '9-10', label: '9–10', min: 9, max: 10 },
    { id: '7-8', label: '7–8', min: 7, max: 8.99 },
    { id: '5-6', label: '5–6', min: 5, max: 6.99 },
    { id: '3-4', label: '3–4', min: 3, max: 4.99 },
    { id: '1-2', label: '1–2', min: 0, max: 2.99 },
];

@Injectable()
export class MediaReviewsPageStoreService extends ComponentStore<MediaReviewsPageState> {
    readonly mediaReviews$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        this.mediaReviewsStore.reviewPageState$,
        ({ band }, media, reviewPage) => {
            const page = remoteData(reviewPage, null);
            const reviews = page?.results ?? [];
            const scoreOf = (rating: number | null | undefined): number | null =>
                typeof rating === 'number' && rating > 0 ? rating : null;
            const ratings = reviews
                .map((review) => scoreOf(review.author_details?.rating))
                .filter((rating): rating is number => rating !== null);
            const averageRating = ratings.length
                ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
                : null;
            const isLoaded = hasRemoteData(reviewPage);
            const hasMore = (page?.page ?? 0) < (page?.total_pages ?? 0);
            const total = page?.total_results || reviews.length;
            const bandCounts = SCORE_BANDS.map(
                ({ min, max }) => ratings.filter((rating) => rating >= min && rating <= max).length,
            );
            const largestBand = Math.max(1, ...bandCounts);
            const activeBand = SCORE_BANDS.find(({ id }) => id === band) ?? null;
            const visibleReviews = activeBand
                ? reviews.filter((review) => {
                      const rating = scoreOf(review.author_details?.rating);
                      return rating !== null && rating >= activeBand.min && rating <= activeBand.max;
                  })
                : reviews;

            return {
                media,
                showSkeleton: reviewPage.state === 'loading',
                showStats: isLoaded && ratings.length > 0,
                hasReviews: isLoaded && visibleReviews.length > 0,
                showEmpty: isLoaded && reviews.length === 0,
                showLoadingMore: reviewPage.state === 'loading-more',
                hasMore: hasMore && !activeBand,
                reviews: visibleReviews.map((review) => ({ review, link: review.id ? [review.id] : null })),
                averageRating,
                // Scores come from the reviews loaded so far; "Show more" adds to them.
                averageLabel: `Average of ${pluralize(ratings.length, 'scored review')}${hasMore ? ' so far' : ''}. ${pluralize(total, 'review')} in all.`,
                showSpread: ratings.length > 1,
                scoreSpread: SCORE_BANDS.map(({ id, label }, index) => ({
                    id,
                    label,
                    count: bandCounts[index],
                    widthPercent: Math.round((bandCounts[index] / largestBand) * 100),
                    isSelected: id === activeBand?.id,
                    ariaLabel: `${label} out of 10: ${pluralize(bandCounts[index], 'review')}`,
                })),
                isFiltered: !!activeBand,
                listLabel: activeBand
                    ? `${pluralize(visibleReviews.length, 'review')} scored ${activeBand.label}`
                    : `Showing ${reviews.length} of ${total}`,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaReviewsStore: MediaReviewsStoreService,
    ) {
        super({ band: null });
    }

    load$(): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(switchMap((target) => this.mediaReviewsStore.load$(target)));
    }

    loadMore$(): Observable<unknown> {
        return this.mediaReviewsStore.loadMoreReviews$();
    }

    toggleBand(band: string): void {
        this.patchState((state) => ({ band: state.band === band ? null : band }));
    }

    clearBand(): void {
        this.patchState({ band: null });
    }
}
