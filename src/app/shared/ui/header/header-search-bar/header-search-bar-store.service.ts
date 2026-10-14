import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, map, switchMap, tap, timer } from 'rxjs';

import { SearchRestControllerService } from '../../../../api';
import { toMediaListItem, toPersonListItem } from '../../../mappers';
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
import { HeaderSearchDismissStep, HeaderSearchOption, HeaderSearchTarget } from './header-search.model';

interface HeaderSearchBarState {
    readonly query: string;
    readonly searchFilter: MediaOrPersonFilterType;
    readonly searchResultsState: RemoteData<readonly HeaderSearchOption[]>;
    // Whether the results panel may show; its content decides if anything renders.
    readonly panelOpen: boolean;
    // The mobile full-screen search sheet.
    readonly searchOpen: boolean;
    readonly activeOptionId: string | null;
}

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LISTBOX_ID = 'header-search-listbox';

const INITIAL_STATE: HeaderSearchBarState = {
    query: '',
    searchFilter: 'all',
    searchResultsState: { state: 'notAsked' },
    panelOpen: false,
    searchOpen: false,
    activeOptionId: null,
};

@Injectable()
export class HeaderSearchBarStoreService extends ComponentStore<HeaderSearchBarState> {
    readonly searchBar$ = this.select(this.state$, this.recentlyViewedStoreService.items$, (state, recentItems) => {
        const query = state.query.trim();
        const panel = toHeaderSearchPanel({
            panelOpen: state.panelOpen,
            query,
            searchFilter: state.searchFilter,
            searchResultsState: state.searchResultsState,
            recentItems,
        });
        const showListbox = panel.kind === 'recent' || panel.kind === 'results';
        const activeOption =
            state.activeOptionId && state.activeOptionId !== HEADER_SEARCH_SEE_ALL_ID
                ? findPanelOption(panel, state.activeOptionId)
                : null;
        const submitTarget: HeaderSearchTarget | null = activeOption
            ? { commands: activeOption.routeCommands }
            : query
              ? { commands: ['/search'], queryParams: toSearchPageQueryParams(query, state.searchFilter) }
              : null;
        // Escape peels back one layer at a time: the panel, then the query, then the mobile sheet.
        const dismissStep: HeaderSearchDismissStep =
            panel.kind !== 'hidden' ? 'panel' : state.query ? 'query' : state.searchOpen ? 'sheet' : 'none';

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
            optionIds: toNavigableOptionIds(panel),
            submitTarget,
            dismissStep,
            statusMessage: toHeaderSearchStatusMessage(panel),
        };
    });

    constructor(
        private readonly searchRestControllerService: SearchRestControllerService,
        private readonly recentlyViewedStoreService: RecentlyViewedStoreService,
        private readonly router: Router,
    ) {
        super(INITIAL_STATE);
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
        this.patchState({ panelOpen: true, activeOptionId: null });
    }

    closePanel(): void {
        this.patchState({ panelOpen: false, activeOptionId: null });
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

    moveActiveOption(delta: 1 | -1, optionIds: readonly string[]): void {
        const { panelOpen, activeOptionId } = this.get();

        if (!panelOpen) {
            this.openPanel();
            return;
        }

        if (!optionIds.length) {
            return;
        }

        const currentIndex = activeOptionId ? optionIds.indexOf(activeOptionId) : -1;
        const nextIndex =
            currentIndex < 0
                ? delta > 0
                    ? 0
                    : optionIds.length - 1
                : (currentIndex + delta + optionIds.length) % optionIds.length;

        this.patchState({ activeOptionId: optionIds[nextIndex] });
    }

    submit(target: HeaderSearchTarget | null): void {
        if (target) {
            this.router.navigate([...target.commands], { queryParams: target.queryParams });
        }
    }

    dismiss(step: HeaderSearchDismissStep): void {
        switch (step) {
            case 'panel':
                this.closePanel();
                break;
            case 'query':
                this.updateQuery('');
                this.closePanel();
                break;
            case 'sheet':
                this.closeSearch();
                break;
        }
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
