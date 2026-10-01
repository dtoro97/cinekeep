import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs';

import { PersonListRestControllerService } from '../../../api';
import { PAGE_SIZE } from '../../../constants';
import {
    RemoteData,
    remoteData,
    toPageItemRange,
    LocaleStoreService,
    parsePageParam,
    PersonListItem,
    toPersonListItem,
} from '../../../shared';

interface PopularPeoplePagination {
    readonly page: number;
    readonly totalPages: number;
}

interface PopularPeopleState {
    readonly resultsState: RemoteData<PersonListItem[]>;
    readonly pagination: PopularPeoplePagination;
    readonly totalResults: number;
}

const EMPTY_PAGINATION: PopularPeoplePagination = {
    page: 0,
    totalPages: 0,
};

const INITIAL_STATE: PopularPeopleState = {
    resultsState: { state: 'notAsked' },
    pagination: { ...EMPTY_PAGINATION },
    totalResults: 0,
};

@Injectable()
export class PopularPeopleStoreService extends ComponentStore<PopularPeopleState> {
    readonly vm$ = this.select((state) => {
        const visibleCount = remoteData(state.resultsState, []).length;
        const resultRange = toPageItemRange({
            page: Math.max(state.pagination.page, 1),
            pageSize: PAGE_SIZE,
            itemCount: visibleCount,
            totalResults: state.totalResults,
        });
        const hasLoadedResults = state.resultsState.state === 'success' || state.resultsState.state === 'loading-more';

        return {
            title: 'Popular People',
            subtitle: 'Actors, filmmakers, and creators trending across movies and TV.',
            resultsState: state.resultsState,
            visibleCount,
            totalResults: state.totalResults,
            resultStart: resultRange.start,
            resultEnd: resultRange.end,
            pageIndex: Math.max(state.pagination.page - 1, 0),
            pageSize: PAGE_SIZE,
            paginatorLength: this.getPaginatorLength(state),
            showResultCount: hasLoadedResults,
            showEmptyState: state.resultsState.state === 'success' && visibleCount === 0,
            showPaginator: hasLoadedResults && this.getPaginatorLength(state) > PAGE_SIZE,
        };
    });

    private readonly loadEffect = this.effect<number>((page$) =>
        page$.pipe(switchMap((page) => this.fetchPage$(page))),
    );

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly personListService: PersonListRestControllerService,
        private readonly localeStore: LocaleStoreService,
    ) {
        super(INITIAL_STATE);
        this.loadEffect(
            this.route.queryParamMap.pipe(
                map((params) => parsePageParam(params.get('page'))),
                distinctUntilChanged(),
            ),
        );
    }

    updatePage(pageIndex: number): void {
        const page = Math.max(1, pageIndex + 1);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: page === 1 ? null : page },
            queryParamsHandling: 'merge',
        });
    }

    private fetchPage$(page: number) {
        this.patchState({
            resultsState: { state: 'loading' },
            pagination: { ...EMPTY_PAGINATION },
            totalResults: 0,
        });

        return this.personListService
            .personPopularList({ language: this.localeStore.language(), page })
            .pipe(
                tap((response) => {
                    const results = (response.results ?? []).map((item) => toPersonListItem(item));

                    this.patchState({
                        resultsState: { state: 'success', data: results },
                        pagination: {
                            page: response.page ?? page,
                            totalPages: response.total_pages ?? 0,
                        },
                        totalResults: response.total_results ?? 0,
                    });
                }),
                catchError(() => {
                    this.patchState({
                        resultsState: {
                            state: 'success',
                            data: [],
                        },
                        pagination: { page, totalPages: page },
                        totalResults: 0,
                    });
                    return EMPTY;
                }),
            );
    }

    private getPaginatorLength(state: PopularPeopleState): number {
        if (state.pagination.totalPages <= 0) {
            return state.totalResults;
        }

        return Math.min(state.totalResults, state.pagination.totalPages * PAGE_SIZE);
    }
}
