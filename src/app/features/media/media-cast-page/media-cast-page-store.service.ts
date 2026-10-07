import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, switchMap } from 'rxjs';

import { SelectOption, remoteData } from '../../../shared';
import { countCrewPeople, filterCreditPeople, toCastPeople, toCrewDepartments } from './cast-crew.mapper';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameMediaTarget } from '../media-target';

export type CreditSection = 'cast' | 'crew';

/** A person in the cast or crew list: their character ("as Dom Cobb") or merged jobs as `role`. */
export interface CreditPerson {
    readonly key: string;
    readonly id: number;
    readonly name: string;
    readonly profilePath: string | null;
    readonly role: string | null;
    /** "62 episodes" for TV credits. */
    readonly episodeLabel: string | null;
    /** Lower-cased name and role, matched by the page filter. */
    readonly searchText: string;
}

export interface CreditDepartment {
    /** Stable value for the department filter. */
    readonly id: string;
    readonly name: string;
    readonly people: readonly CreditPerson[];
}

interface MediaCastPageState {
    readonly section: CreditSection;
    readonly department: string;
    readonly query: string;
}

const ALL_DEPARTMENTS = 'all';
const INITIAL_STATE: MediaCastPageState = {
    section: 'cast',
    department: ALL_DEPARTMENTS,
    query: '',
};

@Injectable()
export class MediaCastPageStoreService extends ComponentStore<MediaCastPageState> {
    readonly castCrew$ = this.select(
        this.state$,
        this.mediaStoreService.mediaDetails$,
        this.mediaCreditsStoreService.creditsState$,
        ({ section, query, department }, media, credits) => {
            const resource = remoteData(credits, { cast: [], crew: [] });
            const castPeople = toCastPeople(resource.cast);
            const departments = toCrewDepartments(resource.crew);
            const crewCount = countCrewPeople(departments);
            const showLoading = credits.state === 'loading';
            const activeSection: CreditSection = !castPeople.length ? 'crew' : !departments.length ? 'cast' : section;
            const normalizedQuery = query.trim().toLocaleLowerCase();
            const cast = filterCreditPeople(castPeople, normalizedQuery);
            const visibleDepartments = departments
                .filter((item) => department === ALL_DEPARTMENTS || item.id === department)
                .map((item) => ({ ...item, people: filterCreditPeople(item.people, normalizedQuery) }))
                .filter((item) => item.people.length > 0);
            const hasMatches = activeSection === 'cast' ? cast.length > 0 : visibleDepartments.length > 0;

            return {
                media,
                isMediaLoading: !media,
                showLoading,
                isEmpty: credits.state === 'success' && castPeople.length === 0 && departments.length === 0,
                query,
                showCast: activeSection === 'cast',
                showDepartments: activeSection === 'crew' && departments.length > 1,
                sectionOptions: [
                    ...(castPeople.length ? [{ label: `Cast (${castPeople.length})`, value: 'cast' as const }] : []),
                    ...(crewCount ? [{ label: `Crew (${crewCount})`, value: 'crew' as const }] : []),
                ] satisfies SelectOption<CreditSection>[],
                section: activeSection,
                departmentOptions: [
                    { label: 'All', value: ALL_DEPARTMENTS },
                    ...departments.map((item) => ({ label: item.name, value: item.id })),
                ],
                department,
                cast,
                departments: visibleDepartments,
                noMatchesText: hasMatches || showLoading ? null : `No one matches “${query.trim()}”.`,
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
                // The filters start over for a new title.
                this.setState(INITIAL_STATE);
                return this.mediaCreditsStoreService.load$(target);
            }),
        );
    }

    setSection(section: CreditSection): void {
        this.patchState({ section });
    }

    setDepartment(department: string): void {
        this.patchState({ department });
    }

    setQuery(query: string): void {
        this.patchState({ query });
    }
}
