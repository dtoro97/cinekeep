import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, of, tap, throwError } from 'rxjs';

import { ReviewPage } from '../../api';
import { RemoteData, hasRemoteData, remoteSuccess, whenSuccess$ } from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

interface MediaReviewsState {
    readonly target: MediaTarget | null;
    readonly reviewPage: RemoteData<ReviewPage | null>;
}

const EMPTY_REVIEW_PAGE: ReviewPage = {
    page: 1,
    results: [],
    total_pages: 1,
    total_results: 0,
};

const INITIAL_STATE: MediaReviewsState = {
    target: null,
    reviewPage: { state: 'notAsked' },
};

@Injectable()
export class MediaReviewsStoreService extends ComponentStore<MediaReviewsState> {
    readonly reviewPageState$ = this.select((state) => state.reviewPage);

    constructor(private readonly mediaApiService: MediaApiService) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<ReviewPage | null> {
        const { target: currentTarget, reviewPage } = this.get();

        if (isSameMediaTarget(currentTarget, target)) {
            if (hasRemoteData(reviewPage)) {
                return of(reviewPage.data);
            }

            if (reviewPage.state === 'loading') {
                return whenSuccess$(this.reviewPageState$);
            }
        }

        this.setState({ ...INITIAL_STATE, target, reviewPage: { state: 'loading' } });

        return this.mediaApiService.getReviews$(target, 1).pipe(
            tap((page) => this.patchState({ reviewPage: remoteSuccess(page) })),
            // Reviews are secondary content, so a failure shows as no reviews.
            catchError(() => {
                this.patchState({ reviewPage: remoteSuccess(EMPTY_REVIEW_PAGE) });
                return of(EMPTY_REVIEW_PAGE);
            }),
        );
    }

    loadMoreReviews$(): Observable<unknown> {
        const { target, reviewPage } = this.get();

        if (!target || reviewPage.state !== 'success' || !reviewPage.data) {
            return EMPTY;
        }

        const loaded = reviewPage.data;
        const currentPage = loaded.page ?? 1;

        if (currentPage >= (loaded.total_pages ?? 1)) {
            return EMPTY;
        }

        this.patchState({ reviewPage: { state: 'loading-more', data: loaded } });

        return this.mediaApiService.getReviews$(target, currentPage + 1).pipe(
            tap((page) =>
                this.patchState({
                    reviewPage: remoteSuccess({
                        ...page,
                        results: [...(loaded.results ?? []), ...(page.results ?? [])],
                    }),
                }),
            ),
            catchError((error) => {
                this.patchState({ reviewPage });
                return throwError(() => error);
            }),
        );
    }
}
