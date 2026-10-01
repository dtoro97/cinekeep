import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, forkJoin, map, Observable, of, tap } from 'rxjs';

import { SearchRestControllerService } from '../../api';
import { PAGE_SIZE, SMALL_LIST_COUNT } from '../../constants';
import {
    RemoteData,
    MediaListItem,
    MediaOrPersonFilterType,
    PersonListItem,
    toMediaListItem,
    toPersonListItem,
} from '../../shared';

export type SearchType = MediaOrPersonFilterType;

interface SectionState<T> {
    results: T[];
    page: number;
    totalPages: number;
    visible: number;
}

interface SearchState {
    query: string;
    type: SearchType;
    movies: SectionState<MediaListItem>;
    tv: SectionState<MediaListItem>;
    people: SectionState<PersonListItem>;
    movieResultsState: RemoteData<MediaListItem[]>;
    tvResultsState: RemoteData<MediaListItem[]>;
    personResultsState: RemoteData<PersonListItem[]>;
}

const EMPTY_SECTION: SectionState<never> = {
    results: [],
    page: 0,
    totalPages: 0,
    visible: 0,
};

const INITIAL_STATE: SearchState = {
    query: '',
    type: 'all',
    movies: { ...EMPTY_SECTION, results: [] },
    tv: { ...EMPTY_SECTION, results: [] },
    people: { ...EMPTY_SECTION, results: [] },
    movieResultsState: { state: 'notAsked' },
    tvResultsState: { state: 'notAsked' },
    personResultsState: { state: 'notAsked' },
};

@Injectable()
export class SearchStoreService extends ComponentStore<SearchState> {
    readonly query$ = this.select((state) => state.query);
    readonly type$ = this.select((state) => state.type);

    readonly movieResultsState$ = this.select((state) => state.movieResultsState);
    readonly tvResultsState$ = this.select((state) => state.tvResultsState);
    readonly personResultsState$ = this.select((state) => state.personResultsState);

    readonly movieHasMore$ = this.select(
        (state) => state.movies.visible < state.movies.results.length || state.movies.page < state.movies.totalPages,
    );
    readonly tvHasMore$ = this.select(
        (state) => state.tv.visible < state.tv.results.length || state.tv.page < state.tv.totalPages,
    );
    readonly personHasMore$ = this.select(
        (state) => state.people.visible < state.people.results.length || state.people.page < state.people.totalPages,
    );

    readonly noSearchResults$ = this.select(
        (state) =>
            state.query !== '' &&
            state.movieResultsState.state === 'success' &&
            state.tvResultsState.state === 'success' &&
            state.personResultsState.state === 'success' &&
            state.movies.results.length === 0 &&
            state.tv.results.length === 0 &&
            state.people.results.length === 0,
    );

    constructor(
        private readonly searchService: SearchRestControllerService,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
    ) {
        super(INITIAL_STATE);
    }

    search$(query: string, type: SearchType): Observable<unknown> {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            this.patchState({
                ...INITIAL_STATE,
                query: trimmedQuery,
                type,
                movieResultsState: { state: 'success', data: [] },
                tvResultsState: { state: 'success', data: [] },
                personResultsState: { state: 'success', data: [] },
            });
            return of(undefined);
        }

        this.patchState({
            ...INITIAL_STATE,
            query: trimmedQuery,
            type,
            movieResultsState:
                type === 'movie' || type === 'all' ? { state: 'loading' } : { state: 'success', data: [] },
            tvResultsState: type === 'tv' || type === 'all' ? { state: 'loading' } : { state: 'success', data: [] },
            personResultsState:
                type === 'person' || type === 'all' ? { state: 'loading' } : { state: 'success', data: [] },
        });

        const initialVisible = type === 'all' ? SMALL_LIST_COUNT : PAGE_SIZE;

        if (type === 'movie') {
            return this.fetchMovies$(trimmedQuery, 1, initialVisible);
        }

        if (type === 'tv') {
            return this.fetchTv$(trimmedQuery, 1, initialVisible);
        }

        if (type === 'person') {
            return this.fetchPeople$(trimmedQuery, 1, initialVisible);
        }

        return forkJoin([
            this.fetchMovies$(trimmedQuery, 1, initialVisible),
            this.fetchTv$(trimmedQuery, 1, initialVisible),
            this.fetchPeople$(trimmedQuery, 1, initialVisible),
        ]);
    }

    loadMoreMovies$(): Observable<unknown> {
        const { movies, query } = this.get();
        if (!query) {
            return of(undefined);
        }

        if (movies.visible < movies.results.length) {
            const nextMovies = { ...movies, visible: movies.results.length };
            this.patchState({
                movies: nextMovies,
                movieResultsState: {
                    state: 'success',
                    data: nextMovies.results.slice(0, nextMovies.visible),
                },
            });
            return of(undefined);
        }

        this.patchState({
            movieResultsState: {
                state: 'loading-more',
                data: movies.results.slice(0, movies.visible),
            },
        });

        return this.fetchMovies$(query, movies.page + 1, movies.results.length + PAGE_SIZE);
    }

    loadMoreTv$(): Observable<unknown> {
        const { tv, query } = this.get();
        if (!query) {
            return of(undefined);
        }

        if (tv.visible < tv.results.length) {
            const nextTv = { ...tv, visible: tv.results.length };
            this.patchState({
                tv: nextTv,
                tvResultsState: {
                    state: 'success',
                    data: nextTv.results.slice(0, nextTv.visible),
                },
            });
            return of(undefined);
        }

        this.patchState({
            tvResultsState: {
                state: 'loading-more',
                data: tv.results.slice(0, tv.visible),
            },
        });

        return this.fetchTv$(query, tv.page + 1, tv.results.length + PAGE_SIZE);
    }

    loadMorePeople$(): Observable<unknown> {
        const { people, query } = this.get();
        if (!query) {
            return of(undefined);
        }

        if (people.visible < people.results.length) {
            const nextPeople = { ...people, visible: people.results.length };
            this.patchState({
                people: nextPeople,
                personResultsState: {
                    state: 'success',
                    data: nextPeople.results.slice(0, nextPeople.visible),
                },
            });
            return of(undefined);
        }

        this.patchState({
            personResultsState: {
                state: 'loading-more',
                data: people.results.slice(0, people.visible),
            },
        });

        return this.fetchPeople$(query, people.page + 1, people.results.length + PAGE_SIZE);
    }

    updateType(type: SearchType): void {
        const query = this.get().query.trim();
        const queryParams: Record<string, string> = {};

        if (query) {
            queryParams['query'] = query;
        }

        if (type !== 'all') {
            queryParams['type'] = type;
        }

        this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams,
        });
    }

    private fetchMovies$(query: string, page: number, visible: number) {
        return this.searchService
            .searchMovie({ query, page })
            .pipe(
                tap((result) => {
                    const mapped = (result.results ?? []).map((item) => toMediaListItem(item, 'movie', 'year'));
                    const current = this.get().movies;
                    const nextMovies: SectionState<MediaListItem> = {
                        results: [...current.results, ...mapped],
                        page: result.page ?? page,
                        totalPages: result.total_pages ?? 0,
                        visible,
                    };
                    this.patchState({
                        movies: nextMovies,
                        movieResultsState: {
                            state: 'success',
                            data: nextMovies.results.slice(0, nextMovies.visible),
                        },
                    });
                }),
                catchError(() => {
                    const currentState = this.get().movieResultsState;
                    this.patchState({
                        movieResultsState: {
                            state: 'success',
                            data: currentState.state === 'loading-more' ? currentState.data : [],
                        },
                    });
                    return EMPTY;
                }),
            );
    }

    private fetchTv$(query: string, page: number, visible: number) {
        return this.searchService
            .searchTv({ query, page })
            .pipe(
                tap((result) => {
                    const mapped = (result.results ?? []).map((item) => toMediaListItem(item, 'tv', 'year'));
                    const current = this.get().tv;
                    const nextTv: SectionState<MediaListItem> = {
                        results: [...current.results, ...mapped],
                        page: result.page ?? page,
                        totalPages: result.total_pages ?? 0,
                        visible,
                    };
                    this.patchState({
                        tv: nextTv,
                        tvResultsState: {
                            state: 'success',
                            data: nextTv.results.slice(0, nextTv.visible),
                        },
                    });
                }),
                catchError(() => {
                    const currentState = this.get().tvResultsState;
                    this.patchState({
                        tvResultsState: {
                            state: 'success',
                            data: currentState.state === 'loading-more' ? currentState.data : [],
                        },
                    });
                    return EMPTY;
                }),
            );
    }

    private fetchPeople$(query: string, page: number, visible: number) {
        return this.searchService
            .searchPerson({ query, page })
            .pipe(
                tap((result) => {
                    const mapped = (result.results ?? []).map((item) => toPersonListItem(item));
                    const current = this.get().people;
                    const nextPeople: SectionState<PersonListItem> = {
                        results: [...current.results, ...mapped],
                        page: result.page ?? page,
                        totalPages: result.total_pages ?? 0,
                        visible,
                    };
                    this.patchState({
                        people: nextPeople,
                        personResultsState: {
                            state: 'success',
                            data: nextPeople.results.slice(0, nextPeople.visible),
                        },
                    });
                }),
                catchError(() => {
                    const currentState = this.get().personResultsState;
                    this.patchState({
                        personResultsState: {
                            state: 'success',
                            data: currentState.state === 'loading-more' ? currentState.data : [],
                        },
                    });
                    return EMPTY;
                }),
            );
    }
}
