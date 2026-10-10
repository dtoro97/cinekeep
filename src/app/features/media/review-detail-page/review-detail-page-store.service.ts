import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, filter, of, switchMap, tap } from 'rxjs';

import { ReviewDetails } from '../../../api';
import {
    RemoteData,
    SeoMetadata,
    formatTitleWithYear,
    isDefined,
    pluralize,
    remoteData,
    remoteSuccess,
    toSeoImage,
} from '../../../shared';
import { MediaApiService } from '../media-api.service';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';
import { toReviewPreviewText } from '../review-card/review-text.mapper';

interface ReviewDetailPageState {
    readonly review: RemoteData<ReviewDetails | null>;
}

const OTHER_REVIEWS_COUNT = 3;

const INITIAL_STATE: ReviewDetailPageState = {
    review: { state: 'notAsked' },
};

@Injectable()
export class ReviewDetailPageStoreService extends ComponentStore<ReviewDetailPageState> {
    readonly reviewDetail$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        this.mediaReviewsStore.reviewPageState$,
        ({ review }, media, reviewPage) => {
            const loadedReview = review.state === 'success' ? review.data : null;
            const author = loadedReview?.author || loadedReview?.author_details?.username;
            const page = remoteData(reviewPage, null);
            const loadedReviews = page?.results ?? [];
            const position = loadedReview ? loadedReviews.findIndex((item) => item.id === loadedReview.id) : -1;
            const toNeighbour = (index: number) => {
                const neighbour = position === -1 ? undefined : loadedReviews[index];
                return neighbour?.id
                    ? {
                          author: neighbour.author || neighbour.author_details?.username || 'Anonymous',
                          link: ['../', neighbour.id],
                      }
                    : null;
            };
            const previousReview = toNeighbour(position - 1);
            const nextReview = toNeighbour(position + 1);
            const otherReviews = loadedReviews
                .flatMap((other) =>
                    other.id && other.id !== loadedReview?.id ? [{ review: other, link: ['../', other.id] }] : [],
                )
                .slice(0, OTHER_REVIEWS_COUNT);

            return {
                media,
                review: loadedReview,
                showSkeleton: review.state === 'notAsked' || review.state === 'loading',
                showUnavailable: review.state === 'success' && !loadedReview,
                pageTitle: author ? `Review by ${author}` : 'Review',
                tmdbUrl: loadedReview?.url ?? null,
                hasOtherReviews: otherReviews.length > 0,
                allReviewsLabel: `All ${pluralize(page?.total_results ?? 0, 'review')}`,
                previousReview,
                nextReview,
                showPager: !!previousReview || !!nextReview,
                otherReviewItems: otherReviews.map(({ review: other, link }) => ({
                    id: other.id ?? '',
                    link,
                    author: other.author || other.author_details?.username || 'Anonymous',
                    score: other.author_details?.rating || null,
                    excerpt: toReviewPreviewText(other.content ?? ''),
                })),
            };
        },
        { debounce: true },
    );

    readonly seoMetadata$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ review }, media): SeoMetadata | null => {
            if (review.state !== 'success' || !review.data) {
                return null;
            }

            const mediaTitle = media
                ? formatTitleWithYear(media.title, media.year)
                : (review.data.media_title ?? 'Review');

            return {
                title: `${mediaTitle} | Review`,
                description: review.data.content || `Read a full review of ${mediaTitle}.`,
                ...toSeoImage(media?.backdropPath, media?.posterPath),
                imageAlt: `${mediaTitle} review preview`,
                type: media?.mediaType === 'tv' ? 'video.tv_show' : 'video.movie',
            };
        },
        { debounce: true },
    ).pipe(filter(isDefined));

    constructor(
        private readonly mediaApiService: MediaApiService,
        private readonly mediaStore: MediaStoreService,
        private readonly mediaReviewsStore: MediaReviewsStoreService,
    ) {
        super(INITIAL_STATE);
    }

    /** The title's first page of reviews, which the page samples for "More reviews". */
    loadOtherReviews$(): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(switchMap((target) => this.mediaReviewsStore.load$(target)));
    }

    loadReview$(reviewId: string | null): Observable<unknown> {
        if (!reviewId) {
            this.patchState({ review: remoteSuccess(null) });
            return of(null);
        }

        this.patchState({ review: { state: 'loading' } });

        return this.mediaApiService.getReviewDetails$(reviewId).pipe(
            tap((review) => this.patchState({ review: remoteSuccess(review) })),
            // A review that cannot be loaded shows as unavailable.
            catchError(() => {
                this.patchState({ review: remoteSuccess(null) });
                return of(null);
            }),
        );
    }
}
