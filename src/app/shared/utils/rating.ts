import { Observable, catchError, tap, throwError } from 'rxjs';

import type { RemoteData } from '../types';

export interface UserRatingState {
    readonly userRating: RemoteData<number | null>;
    readonly ratingPending: boolean;
}

export interface UserRatingVm {
    readonly currentRating: number | null;
    readonly disabled: boolean;
    readonly loading: boolean;
    readonly pending: boolean;
}

export function normalizeRatingValue(value: number): number {
    const normalized = Math.round(Math.min(10, Math.max(0.5, value)) * 2) / 2;
    return Number(normalized.toFixed(1));
}

export const toUserRatingVm = (rating: UserRatingState, hasTarget: boolean): UserRatingVm => ({
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
