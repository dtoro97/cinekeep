import { catchError, EMPTY, map, Observable, switchMap, tap, timer } from 'rxjs';

import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';

import { SearchRestControllerService } from '../../../../api';
import {
    RecentlyViewedItem,
    RecentlyViewedStoreService,
    RemoteData,
    mediaToSearchResultItem,
    multiToSearchResultItem,
    personToSearchResultItem,
    SearchResultItem,
} from '../../..';
import {
    HEADER_SEARCH_SEE_ALL_ID,
    findPanelOption,
    toHeaderSearchPanel,
    toHeaderSearchPlaceholder,
    toHeaderSearchStatusMessage,
    toNavigableOptionIds,
    toSearchPageQueryParams,
} from './header-search.mapper';
import {
    HeaderSearchBarViewModel,
    HeaderSearchDismissStep,
    HeaderSearchPanel,
    HeaderSearchSubmitAction,
    SearchFilterValue,
} from './header-search.model';

export type { SearchFilterValue } from './header-search.model';

interface HeaderSearchBarState {
    readonly query: string;
    readonly searchFilter: SearchFilterValue;
    readonly searchResultsState: RemoteData<readonly SearchResultItem[]>;
    readonly recentItems: readonly RecentlyViewedItem[];
    /** Whether the results panel may show; its content decides if anything renders. */
    readonly panelOpen: boolean;
    /** Mobile full-screen search sheet. */
    readonly searchOpen: boolean;
    readonly activeOptionId: string | null;
}

const SEARCH_DEBOUNCE_MS = 250;

const INITIAL_STATE: HeaderSearchBarState = {
    query: '',
    searchFilter: 'all',
    searchResultsState: { state: 'notAsked' },
    recentItems: [],
    panelOpen: false,
    searchOpen: false,
    activeOptionId: null,
};

const toPanel = (state: HeaderSearchBarState): HeaderSearchPanel =>
    toHeaderSearchPanel({
        panelOpen: state.panelOpen,
        query: state.query.trim(),
        searchFilter: state.searchFilter,
        searchResultsState: state.searchResultsState,
        recentItems: state.recentItems,
    });

@Injectable()
export class HeaderSearchBarStoreService extends ComponentStore<HeaderSearchBarState> {
    readonly vm$: Observable<HeaderSearchBarViewModel> = this.select((state) => {
        const panel = toPanel(state);

        return {
            searchFilter: state.searchFilter,
            searchOpen: state.searchOpen,
            placeholder: toHeaderSearchPlaceholder(state.searchFilter),
            hasQuery: state.query.length > 0,
            panel,
            listboxVisible: panel.kind === 'recent' || panel.kind === 'results',
            activeOptionId: state.activeOptionId,
            statusMessage: toHeaderSearchStatusMessage(panel),
        };
    });

    private readonly updateRecentItems = this.updater(
        (state, recentItems: readonly RecentlyViewedItem[]): HeaderSearchBarState => ({ ...state, recentItems }),
    );

    // Each call cancels the pending request, so clearing or retyping never lets a stale response land.
    private readonly searchEffect = this.effect<void>((trigger$) =>
        trigger$.pipe(
            switchMap(() => {
                const { query, searchFilter } = this.get();
                const trimmedQuery = query.trim();

                if (!trimmedQuery) {
                    return EMPTY;
                }

                return timer(SEARCH_DEBOUNCE_MS).pipe(
                    switchMap(() => this.fetchResults$(trimmedQuery, searchFilter)),
                    tap((data) =>
                        this.patchState({ searchResultsState: { state: 'success', data }, activeOptionId: null }),
                    ),
                    catchError((error: unknown) => {
                        this.patchState({ searchResultsState: { state: 'failure', error }, activeOptionId: null });
                        return EMPTY;
                    }),
                );
            }),
        ),
    );

    constructor(
        private readonly searchService: SearchRestControllerService,
        recentlyViewedStore: RecentlyViewedStoreService,
    ) {
        super(INITIAL_STATE);
        this.updateRecentItems(recentlyViewedStore.items$);
    }

    updateQuery(query: string): void {
        const { searchResultsState } = this.get();

        this.patchState({
            query,
            panelOpen: true,
            activeOptionId: null,
            // Keep the previous results on screen while the next ones load.
            searchResultsState: !query.trim()
                ? { state: 'notAsked' }
                : searchResultsState.state === 'success'
                  ? searchResultsState
                  : { state: 'loading' },
        });
        this.searchEffect();
    }

    updateFilter(searchFilter: SearchFilterValue): void {
        if (this.get().searchFilter === searchFilter) {
            this.openPanel();
            return;
        }

        this.patchState({ searchFilter });
        this.retry();
    }

    retry(): void {
        const hasQuery = this.get().query.trim().length > 0;

        this.patchState({
            panelOpen: true,
            activeOptionId: null,
            searchResultsState: hasQuery ? { state: 'loading' } : { state: 'notAsked' },
        });
        this.searchEffect();
    }

    openPanel(): void {
        if (!this.get().panelOpen) {
            this.patchState({ panelOpen: true, activeOptionId: null });
        }
    }

    closePanel(): void {
        if (this.get().panelOpen) {
            this.patchState({ panelOpen: false, activeOptionId: null });
        }
    }

    openSearch(): void {
        this.patchState({ searchOpen: true });
    }

    toggleSearch(): void {
        this.patchState((state) => ({ searchOpen: !state.searchOpen }));
    }

    closeSearch(): void {
        this.updateQuery('');
        this.patchState({ panelOpen: false, searchOpen: false });
    }

    /** Moves the keyboard highlight and returns the newly active option id. */
    moveActiveOption(delta: 1 | -1): string | null {
        const state = this.get();

        if (!state.panelOpen) {
            this.openPanel();
            return null;
        }

        const ids = toNavigableOptionIds(toPanel(state));

        if (!ids.length) {
            return null;
        }

        const currentIndex = state.activeOptionId ? ids.indexOf(state.activeOptionId) : -1;
        const nextIndex =
            currentIndex < 0 ? (delta > 0 ? 0 : ids.length - 1) : (currentIndex + delta + ids.length) % ids.length;
        const activeOptionId = ids[nextIndex];

        this.patchState({ activeOptionId });

        return activeOptionId;
    }

    getSubmitAction(): HeaderSearchSubmitAction {
        const state = this.get();
        const query = state.query.trim();

        if (state.panelOpen && state.activeOptionId && state.activeOptionId !== HEADER_SEARCH_SEE_ALL_ID) {
            const option = findPanelOption(toPanel(state), state.activeOptionId);

            if (option) {
                return { kind: 'option', routeCommands: option.routeCommands };
            }
        }

        return query
            ? { kind: 'search', queryParams: toSearchPageQueryParams(query, state.searchFilter) }
            : { kind: 'none' };
    }

    /** Escape peels back one layer at a time: the panel, then the query, then the mobile sheet. */
    dismiss(): HeaderSearchDismissStep {
        const state = this.get();

        if (state.panelOpen && toPanel(state).kind !== 'hidden') {
            this.closePanel();
            return 'panel';
        }

        if (state.query) {
            this.updateQuery('');
            this.closePanel();
            return 'query';
        }

        if (state.searchOpen) {
            this.closeSearch();
            return 'sheet';
        }

        return 'none';
    }

    private fetchResults$(query: string, filter: SearchFilterValue): Observable<SearchResultItem[]> {
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
