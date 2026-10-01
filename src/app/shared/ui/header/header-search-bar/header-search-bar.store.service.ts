import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    EMPTY,
    map,
    Observable,
    of,
    switchMap,
    tap,
    withLatestFrom,
} from 'rxjs';

import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';

import { SearchRestControllerService } from '../../../../api';
import {
    RemoteData,
    MediaOrPersonFilterType,
    mediaToSearchResultItem,
    multiToSearchResultItem,
    personToSearchResultItem,
    SearchResultItem,
} from '../../..';

export type SearchFilterValue = MediaOrPersonFilterType;

export type HeaderSearchBarState = {
    readonly searchFilter: SearchFilterValue;
    readonly searchOpen: boolean;
    readonly searchResultsState: RemoteData<SearchResultItem[]>;
    readonly showSearchDropdown: boolean;
};

interface SearchRequest {
    readonly filter: SearchFilterValue;
    readonly query: string;
}

const INITIAL_STATE: HeaderSearchBarState = {
    searchFilter: 'all',
    searchOpen: false,
    searchResultsState: { state: 'notAsked' },
    showSearchDropdown: false,
};

@Injectable()
export class HeaderSearchBarStoreService extends ComponentStore<HeaderSearchBarState> {
    readonly vm$ = this.select((state): HeaderSearchBarState => state);

    private readonly searchFilter$ = this.select((state) => state.searchFilter);

    constructor(private readonly searchService: SearchRestControllerService) {
        super(INITIAL_STATE);
    }

    toggleSearch(): void {
        this.patchState((state) => ({
            searchOpen: !state.searchOpen,
        }));
    }

    setSearchFilter(searchFilter: SearchFilterValue): void {
        this.patchState({ searchFilter });
    }

    showDropdownIfNeeded(): void {
        const state = this.get();

        if (
            state.searchResultsState.state === 'loading' ||
            (state.searchResultsState.state === 'success' && state.searchResultsState.data.length > 0)
        ) {
            this.patchState({ showSearchDropdown: true });
        }
    }

    hideDropdown(): void {
        if (!this.get().showSearchDropdown) {
            return;
        }

        this.patchState({ showSearchDropdown: false });
    }

    closeSearch(): void {
        this.patchState({
            searchOpen: false,
            searchResultsState: { state: 'notAsked' },
            showSearchDropdown: false,
        });
    }

    readonly search = this.effect<string>((query$) =>
        query$.pipe(
            withLatestFrom(this.searchFilter$),
            map(([query, filter]) => ({
                filter,
                query: query.trim(),
            })),
            tap(({ query }) => {
                if (!query) {
                    this.resetSearchState();
                }
            }),
            debounceTime(500),
            distinctUntilChanged(
                (previous, current) => previous.query === current.query && previous.filter === current.filter,
            ),
            tap(({ query }) => {
                if (!query) {
                    return;
                }

                this.setSearchPending();
            }),
            switchMap(({ filter, query }) => {
                if (!query) {
                    return EMPTY;
                }

                return this.getSearchObservable({ filter, query }).pipe(catchError(() => of([] as SearchResultItem[])));
            }),
            tap((searchResults) => {
                this.applySearchResults(searchResults);
            }),
        ),
    );

    private resetSearchState(): void {
        this.patchState({
            searchResultsState: { state: 'notAsked' },
            showSearchDropdown: false,
        });
    }

    private setSearchPending(): void {
        this.patchState({
            searchResultsState: { state: 'loading' },
            showSearchDropdown: true,
        });
    }

    private applySearchResults(searchResults: ReadonlyArray<SearchResultItem>): void {
        const showSearchDropdown = this.get().showSearchDropdown;

        this.patchState({
            searchResultsState: {
                state: 'success',
                data: [...searchResults],
            },
            showSearchDropdown: showSearchDropdown && searchResults.length > 0,
        });
    }

    private getSearchObservable({ filter, query }: SearchRequest): Observable<SearchResultItem[]> {
        switch (filter) {
            case 'movie':
                return this.searchService
                    .searchMovie({ query })
                    .pipe(
                        map((response) =>
                            (response.results ?? []).map((item) => mediaToSearchResultItem(item, 'movie')),
                        ),
                    );
            case 'tv':
                return this.searchService
                    .searchTv({ query })
                    .pipe(
                        map((response) => (response.results ?? []).map((item) => mediaToSearchResultItem(item, 'tv'))),
                    );
            case 'person':
                return this.searchService
                    .searchPerson({ query })
                    .pipe(map((response) => (response.results ?? []).map(personToSearchResultItem)));
            default:
                return this.searchService
                    .searchMulti({ query })
                    .pipe(map((response) => (response.results ?? []).map(multiToSearchResultItem)));
        }
    }
}
