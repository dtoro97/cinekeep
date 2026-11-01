import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, Observable, tap } from 'rxjs';

import { PersonListRestControllerService } from '../../../api';
import { PAGE_SIZE } from '../../../constants';
import {
    hasRemoteData,
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

        return {
            people: people.map((person, index) => ({ person, rank: index + 1 })),
            totalResults,
            shownCount: people.length,
            skeletonCount: results.state === 'loading' || results.state === 'loading-more' ? PAGE_SIZE : 0,
            showCount: hasRemoteData(results) && totalResults > 0,
            showEmptyState: results.state === 'success' && people.length === 0,
            showMore: hasRemoteData(results) && page < totalPages,
            isLoadingMore: results.state === 'loading-more',
        };
    });

    constructor(private personListRestControllerService: PersonListRestControllerService) {
        super(INITIAL_STATE);
    }

    load$(): Observable<unknown> {
        this.setState({ ...INITIAL_STATE, results: { state: 'loading' } });

        return this.loadPage$(1);
    }

    loadMore$(): Observable<unknown> {
        const { page, totalPages, results } = this.get();
        if (results.state !== 'success' || page >= totalPages) {
            return EMPTY;
        }

        this.patchState({ results: { state: 'loading-more', data: results.data } });

        return this.loadPage$(page + 1);
    }

    private loadPage$(page: number): Observable<unknown> {
        return this.personListRestControllerService.personPopularList({ page }).pipe(
            tap((response) =>
                this.patchState(({ results }) => ({
                    page: response.page ?? page,
                    totalPages: response.total_pages ?? 0,
                    totalResults: response.total_results ?? 0,
                    results: remoteSuccess([
                        ...remoteData(results, []),
                        ...(response.results ?? []).map(toKnownForPersonCardItem),
                    ]),
                })),
            ),
            // A failed first page shows the empty state; a failed later page keeps what is already shown.
            catchError(() => {
                this.patchState(({ results }) => ({ totalPages: page - 1, results: remoteSuccess(remoteData(results, [])) }));
                return EMPTY;
            }),
        );
    }
}
