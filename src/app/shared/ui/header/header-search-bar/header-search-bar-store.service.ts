import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, map, switchMap, tap, timer } from 'rxjs';

import { SearchRestControllerService } from '../../../../api';
import { toMediaListItem, toPersonListItem } from '../../../mappers';
import { RecentlyViewedItem } from '../../../models';
import { RecentlyViewedStoreService } from '../../../services/recently-viewed-store.service';
import { MediaOrPersonFilterType, RemoteData } from '../../../types';
import { isMediaResult } from '../../../utils';
import {
    HEADER_SEARCH_SEE_ALL_ID,
    findPanelOption,
    toHeaderSearchPanel,
    toHeaderSearchPlaceholder,
    toHeaderSearchStatusMessage,
    toNavigableOptionIds,
    toPersonResultOption,
    toSearchPageQueryParams,
    toTitleResultOption,
} from './header-search.mapper';
import {
    HeaderSearchDismissStep,
    HeaderSearchOption,
    HeaderSearchPanel,
    HeaderSearchSubmitAction,
} from './header-search.model';

interface HeaderSearchBarState {
    readonly query: string;
    readonly searchFilter: MediaOrPersonFilterType;
    readonly searchResultsState: RemoteData<readonly HeaderSearchOption[]>;
    readonly recentItems: readonly RecentlyViewedItem[];
    /** Whether the results panel may show; its content decides if anything renders. */
    readonly panelOpen: boolean;
    /** Mobile full-screen search sheet. */
    readonly searchOpen: boolean;
    readonly activeOptionId: string | null;
}

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LISTBOX_ID = 'header-search-listbox';

const INITIAL_STATE: HeaderSearchBarState = {
    query: '',
    searchFilter: 'all',
    searchResultsState: { state: 'notAsked' },
    recentItems: [],
    panelOpen: false,
    searchOpen: false,
    activeOptionId: null,
};

@Injectable()
export class HeaderSearchBarStoreService extends ComponentStore<HeaderSearchBarState> {
    readonly searchBar$ = this.select((state) => {
        const panel = toPanel(state);

        const showListbox = panel.kind === 'recent' || panel.kind === 'results';

        return {
            searchFilter: state.searchFilter,
            searchOpen: state.searchOpen,
            placeholder: toHeaderSearchPlaceholder(state.searchFilter),
            hasQuery: state.query.length > 0,
            panel,
            showListbox,
            listboxId: SEARCH_LISTBOX_ID,
            ariaControls: showListbox ? SEARCH_LISTBOX_ID : null,
            activeOptionId: state.activeOptionId,
            statusMessage: toHeaderSearchStatusMessage(panel),
        };
    });

    constructor(
        private readonly searchRestControllerService: SearchRestControllerService,
        recentlyViewedStoreService: RecentlyViewedStoreService,
    ) {
        super(INITIAL_STATE);
        recentlyViewedStoreService.items$
            .pipe(takeUntilDestroyed())
            .subscribe((recentItems) => this.patchState({ recentItems }));
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

    updateFilter(searchFilter: MediaOrPersonFilterType): void {
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
                    switchMap(() => {
                        switch (searchFilter) {
                            case 'movie':
                                return this.searchRestControllerService
                                    .searchMovie({ query: trimmedQuery })
                                    .pipe(
                                        map(({ results }) =>
                                            (results ?? [])
                                                .filter(({ id }) => !!id)
                                                .map((item) =>
                                                    toTitleResultOption(toMediaListItem(item, 'movie', 'year')),
                                                ),
                                        ),
                                    );
                            case 'tv':
                                return this.searchRestControllerService
                                    .searchTv({ query: trimmedQuery })
                                    .pipe(
                                        map(({ results }) =>
                                            (results ?? [])
                                                .filter(({ id }) => !!id)
                                                .map((item) =>
                                                    toTitleResultOption(toMediaListItem(item, 'tv', 'year')),
                                                ),
                                        ),
                                    );
                            case 'person':
                                return this.searchRestControllerService
                                    .searchPerson({ query: trimmedQuery })
                                    .pipe(
                                        map(({ results }) =>
                                            (results ?? [])
                                                .filter(({ id }) => !!id)
                                                .map((person) => toPersonResultOption(toPersonListItem(person))),
                                        ),
                                    );
                            default:
                                return this.searchRestControllerService
                                    .searchMulti({ query: trimmedQuery })
                                    .pipe(
                                        map(({ results }) =>
                                            (results ?? [])
                                                .filter(({ id }) => !!id)
                                                .flatMap((item) =>
                                                    isMediaResult(item)
                                                        ? [
                                                              toTitleResultOption(
                                                                  toMediaListItem(item, item.media_type, 'year'),
                                                              ),
                                                          ]
                                                        : item.media_type === 'person'
                                                          ? [toPersonResultOption(toPersonListItem(item))]
                                                          : [],
                                                ),
                                        ),
                                    );
                        }
                    }),
                    tap((data) =>
                        this.patchState({ searchResultsState: { state: 'success', data }, activeOptionId: null }),
                    ),
                    catchError((error: unknown) => {
                        this.patchState({ searchResultsState: { state: 'failure', error }, activeOptionId: null });
                        // The panel displays the error while the effect stays available for retry.
                        return EMPTY;
                    }),
                );
            }),
        ),
    );
}

const toPanel = (state: HeaderSearchBarState): HeaderSearchPanel =>
    toHeaderSearchPanel({
        panelOpen: state.panelOpen,
        query: state.query.trim(),
        searchFilter: state.searchFilter,
        searchResultsState: state.searchResultsState,
        recentItems: state.recentItems,
    });
