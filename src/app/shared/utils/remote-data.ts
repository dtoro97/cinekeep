import { Observable, catchError, defer, filter, map, of, take, tap } from 'rxjs';

import type { RemoteData } from '../types';

export const remoteData = <T>(state: RemoteData<T>, fallback: T): T =>
    state.state === 'success' || state.state === 'loading-more' ? state.data : fallback;

export const remoteSuccess = <T>(data: T): RemoteData<T> => ({
    state: 'success',
    data,
});

export const hasRemoteData = <T>(
    state: RemoteData<T>,
): state is Extract<RemoteData<T>, { state: 'success' | 'loading-more' }> =>
    state.state === 'success' || state.state === 'loading-more';

export const mapRemoteData = <T, R>(
    state: RemoteData<T>,
    mapData: (data: T) => R,
): RemoteData<R> => {
    switch (state.state) {
        case 'success':
            return { state: 'success', data: mapData(state.data) };
        case 'loading-more':
            return { state: 'loading-more', data: mapData(state.data) };
        case 'failure':
            return { state: 'failure', error: state.error };
        default:
            return { state: state.state };
    }
};

export const updateRemoteData = <T>(state: RemoteData<T>, update: (data: T) => T): RemoteData<T> =>
    hasRemoteData(state) ? { ...state, data: update(state.data) } : state;

/** Emits the data the first time the state settles on `success`, then completes. */
export const whenSuccess$ = <T>(state$: Observable<RemoteData<T>>): Observable<T> =>
    state$.pipe(
        filter((state): state is Extract<RemoteData<T>, { state: 'success' }> => state.state === 'success'),
        take(1),
        map((state) => state.data),
    );

export interface CachedResourceRequest<T> {
    /** The resource's state right now. */
    readonly current: RemoteData<T>;
    /** The resource's state over time, used to wait for a request already in flight. */
    readonly state$: Observable<RemoteData<T>>;
    readonly fetch: () => Observable<T>;
    readonly patch: (state: RemoteData<T>) => void;
    /** Stored and emitted as a successful result when the request fails. */
    readonly fallback: T;
}

/**
 * Loads a resource at most once: a loaded resource is returned as is, a resource in flight
 * is awaited, and anything else is fetched and written back through `patch`.
 */
export const loadCachedResource$ = <T>({
    current,
    state$,
    fetch,
    patch,
    fallback,
}: CachedResourceRequest<T>): Observable<T> => {
    if (current.state === 'success') {
        return of(current.data);
    }

    if (current.state === 'loading') {
        return whenSuccess$(state$);
    }

    patch({ state: 'loading' });

    return defer(fetch).pipe(
        tap((data) => patch(remoteSuccess(data))),
        catchError(() => {
            patch(remoteSuccess(fallback));
            return of(fallback);
        }),
    );
};
