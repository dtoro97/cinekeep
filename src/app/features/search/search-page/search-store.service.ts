import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, forkJoin, map, Observable, tap } from 'rxjs';

import { SearchRestControllerService } from '../../../api';
import { PAGE_SIZE, SMALL_LIST_COUNT } from '../../../constants';
import {
    GenreService,
    MediaListItem,
    MediaOrPersonFilterType,
    MediaOrPersonType,
    PersonListItem,
    RemoteData,
    toMediaListEntryState,
    toMediaListItem,
    toPersonListItem,
} from '../../../shared';

interface SearchResultsBySection {
    movie: MediaListItem;
    tv: MediaListItem;
    person: PersonListItem;
}

interface SearchResultsPage<T> {
    results: T[];
    page: number;
    totalPages: number;
}

interface SearchSection<T> extends SearchResultsPage<T> {
    status: 'notAsked' | 'loading' | 'loading-more' | 'success';
    visible: number;
}

type SearchSections = { [K in MediaOrPersonType]: SearchSection<SearchResultsBySection[K]> };

interface SearchState {
    query: string;
    type: MediaOrPersonFilterType;
    sections: SearchSections;
}

const SECTION_KEYS: MediaOrPersonType[] = ['movie', 'tv', 'person'];

const EMPTY_SECTION: SearchSection<never> = {
    status: 'notAsked',
    results: [],
    page: 0,
    totalPages: 0,
    visible: 0,
};

const INITIAL_STATE: SearchState = {
    query: '',
    type: 'all',
    sections: { movie: EMPTY_SECTION, tv: EMPTY_SECTION, person: EMPTY_SECTION },
};

@Injectable()
export class SearchStoreService extends ComponentStore<SearchState> {
    readonly query$ = this.select((state) => state.query);

    readonly searchResults$ = this.select(
        this.state$,
        this.genreService.movieGenres$,
        this.genreService.tvGenres$,
        ({ query, type, sections }, movieGenres, tvGenres) => {
            const hasQuery = query.length > 0;
            const resultSections = [
                {
                    key: 'movie' as const,
                    title: 'Movies',
                    moreLabel: 'Show more movies',
                    state: toMediaListEntryState(toSectionState(sections.movie), movieGenres),
                    hasMore: hasMoreResults(sections.movie),
                },
                {
                    key: 'tv' as const,
                    title: 'TV series',
                    moreLabel: 'Show more TV series',
                    state: toMediaListEntryState(toSectionState(sections.tv), tvGenres),
                    hasMore: hasMoreResults(sections.tv),
                },
                {
                    key: 'person' as const,
                    title: 'People',
                    moreLabel: 'Show more people',
                    state: toSectionState(sections.person),
                    hasMore: hasMoreResults(sections.person),
                },
            ];

            return {
                type,
                hasQuery,
                pageTitle: hasQuery ? `Results for "${query}"` : 'Search',
                skeletonCount: type === 'all' ? SMALL_LIST_COUNT : PAGE_SIZE,
                sections: resultSections.filter(
                    ({ state }) =>
                        hasQuery &&
                        (state.state === 'loading' ||
                            state.state === 'loading-more' ||
                            (state.state === 'success' && state.data.length > 0)),
                ),
                hasNoResults:
                    hasQuery &&
                    SECTION_KEYS.every(
                        (key) => sections[key].status === 'success' && sections[key].results.length === 0,
                    ),
            };
        },
    );

    private readonly requests: {
        [K in MediaOrPersonType]: (query: string, page: number) => Observable<SearchResultsPage<SearchResultsBySection[K]>>;
    } = {
        movie: (query, page) =>
            this.searchRestControllerService
                .searchMovie({ query, page })
                .pipe(map((response) => toResultsPage(response, page, (item) => toMediaListItem(item, 'movie', 'year')))),
        tv: (query, page) =>
            this.searchRestControllerService
                .searchTv({ query, page })
                .pipe(map((response) => toResultsPage(response, page, (item) => toMediaListItem(item, 'tv', 'year')))),
        person: (query, page) =>
            this.searchRestControllerService
                .searchPerson({ query, page })
                .pipe(map((response) => toResultsPage(response, page, (item) => toPersonListItem(item)))),
    };

    constructor(
        private searchRestControllerService: SearchRestControllerService,
        private genreService: GenreService,
        private router: Router,
        private activatedRoute: ActivatedRoute,
    ) {
        super(INITIAL_STATE);
    }

    search$(query: string, type: MediaOrPersonFilterType): Observable<unknown> {
        const trimmedQuery = query.trim();
        const requestedKeys = SECTION_KEYS.filter((key) => trimmedQuery && (type === 'all' || type === key));
        const toInitialSection = (key: MediaOrPersonType): SearchSection<never> => ({
            ...EMPTY_SECTION,
            status: requestedKeys.includes(key) ? 'loading' : 'success',
        });

        this.setState({
            query: trimmedQuery,
            type,
            sections: { movie: toInitialSection('movie'), tv: toInitialSection('tv'), person: toInitialSection('person') },
        });

        const visible = type === 'all' ? SMALL_LIST_COUNT : PAGE_SIZE;
        return forkJoin(requestedKeys.map((key) => this.fetchPage$(key, trimmedQuery, 1, visible)));
    }

    loadMore$(key: MediaOrPersonType): Observable<unknown> {
        const { query, sections } = this.get();
        const section = sections[key];
        if (!query) {
            return EMPTY;
        }

        if (section.visible < section.results.length) {
            this.patchSection(key, (current) => ({ ...current, visible: current.results.length }));
            return EMPTY;
        }

        this.patchSection(key, (current) => ({ ...current, status: 'loading-more' }));
        return this.fetchPage$(key, query, section.page + 1, section.results.length + PAGE_SIZE);
    }

    setType(type: MediaOrPersonFilterType): void {
        const { query } = this.get();
        this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { query: query || undefined, type: type === 'all' ? undefined : type },
        });
    }

    private fetchPage$<K extends MediaOrPersonType>(
        key: K,
        query: string,
        page: number,
        visible: number,
    ): Observable<unknown> {
        return this.requests[key](query, page).pipe(
            tap((response) =>
                this.patchSection(key, (current) => ({
                    status: 'success',
                    results: [...current.results, ...response.results],
                    page: response.page,
                    totalPages: response.totalPages,
                    visible,
                })),
            ),
            // A failed first page leaves the section empty and hidden; a failed "show more" keeps what is listed.
            catchError(() => {
                this.patchSection(key, (current) => ({ ...current, status: 'success' }));
                return EMPTY;
            }),
        );
    }

    private patchSection<K extends MediaOrPersonType>(
        key: K,
        update: (section: SearchSection<SearchResultsBySection[K]>) => SearchSection<SearchResultsBySection[K]>,
    ): void {
        this.patchState((state) => ({ sections: { ...state.sections, [key]: update(state.sections[key]) } }));
    }
}

function hasMoreResults(section: SearchSection<unknown>): boolean {
    return section.visible < section.results.length || section.page < section.totalPages;
}

function toSectionState<T>({ status, results, visible }: SearchSection<T>): RemoteData<T[]> {
    switch (status) {
        case 'notAsked':
        case 'loading':
            return { state: status };
        default:
            return { state: status, data: results.slice(0, visible) };
    }
}

function toResultsPage<TItem, TResult>(
    response: { results?: TItem[]; page?: number; total_pages?: number },
    requestedPage: number,
    toResult: (item: TItem) => TResult,
): SearchResultsPage<TResult> {
    return {
        results: (response.results ?? []).map((item) => toResult(item)),
        page: response.page ?? requestedPage,
        totalPages: response.total_pages ?? 0,
    };
}
