import { Observable, catchError, tap, throwError } from 'rxjs';

import type { RemoteData } from '../../shared';

export interface UserRatingState {
    readonly userRating: RemoteData<number | null>;
    readonly ratingPending: boolean;
}

export const toUserRatingDisplay = (rating: UserRatingState, hasTarget: boolean) => ({
    currentRating: rating.userRating.state === 'success' ? rating.userRating.data : null,
    disabled: !hasTarget || rating.ratingPending || rating.userRating.state === 'loading',
    loading: rating.userRating.state === 'loading',
    pending: rating.ratingPending,
});

/**
 * Marks the rating as pending while `request$` runs, then stores `nextRating` on success or
 * clears the pending flag on failure and rethrows.
 */
export const writeUserRating$ = (
    request$: Observable<unknown>,
    nextRating: number | null,
    patch: (patch: Partial<UserRatingState>) => void,
): Observable<unknown> => {
    patch({ ratingPending: true });

    return request$.pipe(
        tap(() => patch({ userRating: { state: 'success', data: nextRating }, ratingPending: false })),
        catchError((error: unknown) => {
            patch({ ratingPending: false });
            return throwError(() => error);
        }),
    );
};
