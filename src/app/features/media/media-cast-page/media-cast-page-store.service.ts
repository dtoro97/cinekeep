import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, switchMap } from 'rxjs';

import { remoteData } from '../../../shared';
import { countCrewPeople, filterCreditPeople, toCastPeople, toCrewDepartments } from './cast-crew.mapper';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameMediaTarget } from '../media-target';

// A person in the cast or crew list: their character ("as Dom Cobb") or merged jobs as `role`.
export interface CreditPerson {
    readonly key: string;
    readonly id: number;
    readonly name: string;
    readonly profilePath: string | null;
    readonly role: string | null;
    // "62 episodes" for TV credits.
    readonly episodeLabel: string | null;
    // Lower-cased name and role, matched by the page filter.
    readonly searchText: string;
}

export interface CreditDepartment {
    // Stable value for the department filter.
    readonly id: string;
    readonly name: string;
    readonly people: readonly CreditPerson[];
}

interface MediaCastPageState {
    readonly query: string;
}

const INITIAL_STATE: MediaCastPageState = { query: '' };

@Injectable()
export class MediaCastPageStoreService extends ComponentStore<MediaCastPageState> {
    readonly castCrew$ = this.select(
        this.state$,
        this.mediaStoreService.mediaDetails$,
        this.mediaCreditsStoreService.creditsState$,
        ({ query }, media, credits) => {
            const resource = remoteData(credits, { cast: [], crew: [] });
            const castPeople = toCastPeople(resource.cast);
            const departments = toCrewDepartments(resource.crew);
            const showLoading = credits.state === 'loading';
            const normalizedQuery = query.trim().toLocaleLowerCase();
            const cast = filterCreditPeople(castPeople, normalizedQuery);
            const visibleDepartments = departments
                .map((item) => ({ ...item, people: filterCreditPeople(item.people, normalizedQuery) }))
                .filter((item) => item.people.length > 0);

            return {
                media,
                showLoading,
                isEmpty: credits.state === 'success' && castPeople.length === 0 && departments.length === 0,
                query,
                crewCount: countCrewPeople(departments),
                cast,
                departments: visibleDepartments,
                showCast: cast.length > 0,
                showCrew: visibleDepartments.length > 0,
                noMatchesText:
                    showLoading || cast.length || visibleDepartments.length ? null : `No one matches “${query.trim()}”.`,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly mediaCreditsStoreService: MediaCreditsStoreService,
        private readonly mediaStoreService: MediaStoreService,
    ) {
        super(INITIAL_STATE);
    }

    load$(): Observable<unknown> {
        return this.mediaStoreService.currentTarget$.pipe(
            distinctUntilChanged(isSameMediaTarget),
            switchMap((target) => {
                // The filter starts over for a new title.
                this.setState(INITIAL_STATE);
                return this.mediaCreditsStoreService.load$(target);
            }),
        );
    }

    setQuery(query: string): void {
        this.patchState({ query });
    }
}
