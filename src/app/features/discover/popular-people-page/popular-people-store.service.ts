import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, distinctUntilChanged, EMPTY, map, switchMap, tap } from 'rxjs';

import { PersonListRestControllerService } from '../../../api';
import { PAGE_SIZE } from '../../../constants';
import {
    hasRemoteData,
    LocaleStoreService,
    parsePageParam,
    PersonCardItem,
    RemoteData,
    remoteData,
    remoteSuccess,
    toKnownForPersonCardItem,
} from '../../../shared';

interface PopularPeopleState {
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
    readonly results: RemoteData<PersonCardItem[]>;
}

const LOADING_SKELETON_COUNT = 20;

const INITIAL_STATE: PopularPeopleState = {
    page: 0,
    totalPages: 0,
    totalResults: 0,
    results: { state: 'notAsked' },
};

@Injectable()
export class PopularPeopleStoreService extends ComponentStore<PopularPeopleState> {
    readonly popularPeople$ = this.select(({ page, totalPages, totalResults, results }) => {
        const people = remoteData(results, []);
        const hasResults = hasRemoteData(results);
        const paginatorLength = totalPages <= 0 ? totalResults : Math.min(totalResults, totalPages * PAGE_SIZE);

        return {
            people,
            totalResults,
            skeletonCount: results.state === 'loading' ? LOADING_SKELETON_COUNT : 0,
            pageIndex: Math.max(page - 1, 0),
            pageSize: PAGE_SIZE,
            paginatorLength,
            showResultCount: hasResults,
            showEmptyState: results.state === 'success' && people.length === 0,
            showPaginator: hasResults && paginatorLength > PAGE_SIZE,
        };
    });

    private readonly loadPage = this.effect<number>((page$) =>
        page$.pipe(
            switchMap((page) => {
                this.setState({ ...INITIAL_STATE, results: { state: 'loading' } });

                return this.personListRestControllerService
                    .personPopularList({ language: this.localeStoreService.language(), page })
                    .pipe(
                        tap((response) =>
                            this.patchState({
                                page: response.page ?? page,
                                totalPages: response.total_pages ?? 0,
                                totalResults: response.total_results ?? 0,
                                results: remoteSuccess((response.results ?? []).map(toKnownForPersonCardItem)),
                            }),
                        ),
                        // A failed page shows the empty state instead of an error.
                        catchError(() => {
                            this.patchState({ page, totalPages: page, results: remoteSuccess([]) });
                            return EMPTY;
                        }),
                    );
            }),
        ),
    );

    constructor(
        private activatedRoute: ActivatedRoute,
        private router: Router,
        private personListRestControllerService: PersonListRestControllerService,
        private localeStoreService: LocaleStoreService,
    ) {
        super(INITIAL_STATE);

        this.loadPage(
            activatedRoute.queryParamMap.pipe(
                map((params) => parsePageParam(params.get('page'))),
                distinctUntilChanged(),
            ),
        );
    }

    setPage(pageIndex: number): void {
        const page = Math.max(1, pageIndex + 1);

        this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { page: page === 1 ? null : page },
            queryParamsHandling: 'merge',
        });
    }
}
