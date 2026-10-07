import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, filter, of, tap } from 'rxjs';

import { ReviewDetails } from '../../../api';
import { RemoteData, SeoMetadata, formatTitleWithYear, isDefined, remoteSuccess, toSeoImage } from '../../../shared';
import { MediaApiService } from '../media-api.service';
import { MediaStoreService } from '../media-store.service';

interface ReviewDetailPageState {
    readonly review: RemoteData<ReviewDetails | null>;
}

const INITIAL_STATE: ReviewDetailPageState = {
    review: { state: 'notAsked' },
};

@Injectable()
export class ReviewDetailPageStoreService extends ComponentStore<ReviewDetailPageState> {
    readonly reviewDetail$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        ({ review }, media) => {
            const loadedReview = review.state === 'success' ? review.data : null;
            const author = loadedReview?.author || loadedReview?.author_details?.username;

            return {
                media,
                review: loadedReview,
                showSkeleton: review.state === 'notAsked' || review.state === 'loading',
                showUnavailable: review.state === 'success' && !loadedReview,
                pageTitle: author ? `Review by ${author}` : 'Review',
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
    ) {
        super(INITIAL_STATE);
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
