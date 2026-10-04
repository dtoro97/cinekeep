import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

import { Review, ReviewPage } from '../../api';
import { RemoteData, mapRemoteData, whenSuccess$ } from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

const REVIEW_PREVIEW_COUNT = 3;
const REVIEW_PREVIEW_MIN_CONTENT_LENGTH = 100;

interface ReviewPaginationState {
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
}

export interface ReviewRatingSummary {
    readonly ratedCount: number;
    readonly averageRating: number | null;
}

interface MediaReviewsState {
    readonly target: MediaTarget | null;
    readonly reviewPage: RemoteData<ReviewPage | null>;
}

const INITIAL_STATE: MediaReviewsState = {
    target: null,
    reviewPage: { state: 'notAsked' },
};

@Injectable()
export class MediaReviewsStoreService extends ComponentStore<MediaReviewsState> {
    private readonly reviewPageState$ = this.select((state) => state.reviewPage);

    readonly reviewsState$ = this.reviewPageState$.pipe(
        map((state): RemoteData<Review[]> => mapRemoteData(state, (page) => page?.results ?? [])),
    );

    private readonly pagination$ = this.reviewPageState$.pipe(
        map((state): ReviewPaginationState => {
            const page = state.state === 'success' || state.state === 'loading-more' ? state.data : null;

            return {
                page: page?.page ?? 0,
                totalPages: page?.total_pages ?? 0,
                totalResults: page?.total_results ?? 0,
            };
        }),
    );

    readonly totalResults$ = this.pagination$.pipe(map((pagination) => pagination.totalResults));

    readonly hasMore$ = this.pagination$.pipe(map((pagination) => pagination.page < pagination.totalPages));

    readonly ratingSummary$ = this.reviewsState$.pipe(
        map((state): ReviewRatingSummary => {
            const reviews = state.state === 'success' || state.state === 'loading-more' ? state.data : [];
            const ratings = reviews
                .map((review) => review.author_details?.rating)
                .filter((rating): rating is number => typeof rating === 'number' && rating > 0);
            const total = ratings.reduce((sum, rating) => sum + rating, 0);

            return {
                ratedCount: ratings.length,
                averageRating: ratings.length ? Math.round((total / ratings.length) * 10) / 10 : null,
            };
        }),
    );

    readonly previewReviews$ = this.reviewsState$.pipe(
        map((state) => {
            const reviews = state.state === 'success' ? state.data : [];
            return this.sortReviews(
                reviews.filter((review) => (review.content?.trim().length ?? 0) >= REVIEW_PREVIEW_MIN_CONTENT_LENGTH),
            ).slice(0, REVIEW_PREVIEW_COUNT);
        }),
    );

    constructor(private readonly mediaApiService: MediaApiService) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<ReviewPage | null> {
        const state = this.get();

        if (isSameMediaTarget(state.target, target)) {
            if (state.reviewPage.state === 'success' || state.reviewPage.state === 'loading-more') {
                return of(state.reviewPage.data);
            }

            if (state.reviewPage.state === 'loading') {
                return whenSuccess$(this.reviewPageState$);
            }
        }

        this.setState({
            ...INITIAL_STATE,
            target,
            reviewPage: { state: 'loading' },
        });

        return this.mediaApiService.getReviews$(target, 1).pipe(
            tap((reviewPage) => {
                this.patchState({ reviewPage: { state: 'success', data: reviewPage } });
            }),
            catchError(() => {
                const reviewPage = emptyReviewPage();
                this.patchState({ reviewPage: { state: 'success', data: reviewPage } });
                return of(reviewPage);
            }),
        );
    }

    loadMoreReviews$(): Observable<ReviewPage | undefined> {
        const { target, reviewPage } = this.get();

        if (!target || reviewPage.state !== 'success' || !reviewPage.data) {
            return of(undefined);
        }

        const currentPage = reviewPage.data.page ?? 1;
        const totalPages = reviewPage.data.total_pages ?? 1;

        if (currentPage >= totalPages) {
            return of(undefined);
        }

        this.patchState({
            reviewPage: {
                state: 'loading-more',
                data: reviewPage.data,
            },
        });

        return this.mediaApiService.getReviews$(target, currentPage + 1).pipe(
            tap((page) => {
                this.patchState({
                    reviewPage: {
                        state: 'success',
                        data: {
                            ...page,
                            results: [...(reviewPage.data?.results ?? []), ...(page.results ?? [])],
                        },
                    },
                });
            }),
            catchError((error) => {
                this.patchState({ reviewPage });
                return throwError(() => error);
            }),
        );
    }

    private sortReviews(reviews: Review[]): Review[] {
        return [...reviews].sort((left, right) => {
            const leftHasRating = typeof left.author_details?.rating === 'number';
            const rightHasRating = typeof right.author_details?.rating === 'number';

            if (leftHasRating === rightHasRating) {
                return 0;
            }

            return leftHasRating ? -1 : 1;
        });
    }
}

const emptyReviewPage = (): ReviewPage => ({
    page: 1,
    results: [],
    total_pages: 1,
    total_results: 0,
});
