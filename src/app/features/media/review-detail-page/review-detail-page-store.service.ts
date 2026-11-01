import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { marked } from 'marked';
import { Observable, catchError, filter, of, switchMap, tap } from 'rxjs';

import { ReviewDetails } from '../../../api';
import {
    RemoteData,
    SeoMetadata,
    formatTitleWithYear,
    isDefined,
    remoteData,
    remoteSuccess,
    toSeoImage,
} from '../../../shared';
import { MediaApiService } from '../media-api.service';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';

interface ReviewDetailPageState {
    readonly review: RemoteData<ReviewDetails | null>;
}

const MORE_REVIEWS_COUNT = 4;

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
            const content = loadedReview?.content ?? '';
            const rendered = content ? marked.parse(content, { breaks: true, gfm: true }) : '';
            const page = remoteData(reviewPage, null);

            return {
                media,
                review: loadedReview,
                author: loadedReview?.author || loadedReview?.author_details?.username || 'Anonymous',
                score: loadedReview?.author_details?.rating || null,
                contentHtml: typeof rendered === 'string' ? rendered : content,
                showSkeleton: review.state === 'notAsked' || review.state === 'loading',
                showUnavailable: review.state === 'success' && !loadedReview,
                reviewCount: page?.total_results ?? null,
                moreReviews: (page?.results ?? [])
                    .filter((item) => item.id && item.id !== loadedReview?.id)
                    .slice(0, MORE_REVIEWS_COUNT)
                    .map((item) => ({
                        id: item.id,
                        author: item.author || item.author_details?.username || 'Anonymous',
                        score: item.author_details?.rating || null,
                        createdAt: item.created_at ?? null,
                        link: ['../', item.id],
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
        private readonly mediaReviewsStore: MediaReviewsStoreService,
        private readonly mediaStore: MediaStoreService,
    ) {
        super(INITIAL_STATE);
    }

    // The title's other reviews, for the More reviews list; already loaded when coming from the reviews page.
    loadReviews$(): Observable<unknown> {
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
