import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, combineLatest, distinctUntilChanged, filter, switchMap } from 'rxjs';

import { RemoteData, SelectOption, isDefined, remoteData } from '../../../shared';
import { countCrewPeople, filterCreditPeople, toCastPeople, toCrewDepartments } from '../mappers/cast-crew.mapper';
import { MediaCreditsResource, MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaTarget, isSameMediaTarget } from '../media-target';
import { MediaDetails } from '../models/media-details.model';

export type CreditSection = 'cast' | 'crew';

interface MediaCastPageState {
    readonly media: MediaDetails | null;
    readonly credits: RemoteData<MediaCreditsResource>;
    readonly section: CreditSection;
    readonly department: string;
    readonly query: string;
}

const ALL_DEPARTMENTS = 'all';
const INITIAL_STATE: MediaCastPageState = {
    media: null,
    credits: { state: 'notAsked' },
    section: 'cast',
    department: ALL_DEPARTMENTS,
    query: '',
};

@Injectable()
export class MediaCastPageStoreService extends ComponentStore<MediaCastPageState> {
    readonly castCrew$ = this.select(({ media, credits, section, query, department }) => {
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
    });

    constructor(
        private readonly mediaCreditsStoreService: MediaCreditsStoreService,
        mediaStoreService: MediaStoreService,
    ) {
        super(INITIAL_STATE);
        this.loadCredits(
            mediaStoreService.currentTarget$.pipe(filter(isDefined), distinctUntilChanged(isSameMediaTarget)),
        );
        combineLatest([mediaStoreService.mediaDetailsState$, mediaCreditsStoreService.creditsState$])
            .pipe(takeUntilDestroyed())
            .subscribe(([mediaState, credits]) =>
                this.patchState({
                    media: mediaState.state === 'success' ? mediaState.data : null,
                    credits,
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

    private readonly loadCredits = this.effect<MediaTarget>((target$) =>
        target$.pipe(
            switchMap((target) => {
                // Media and credits mirror their stores; only this page's filters start over for a new title.
                this.patchState({ section: 'cast', department: ALL_DEPARTMENTS, query: '' });
                return this.mediaCreditsStoreService.load$(target).pipe(
                    // Credit failures stay local to this page and future titles can still load.
                    catchError((error: unknown) => {
                        this.patchState({ credits: { state: 'failure', error } });
                        return EMPTY;
                    }),
                );
            }),
        ),
    );
}
