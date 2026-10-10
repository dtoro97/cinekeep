import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { ParamMap } from '@angular/router';
import { Observable, distinctUntilChanged, map, switchMap } from 'rxjs';

import { SelectOption, remoteData } from '../../../shared';
import { countCrewPeople, filterCreditPeople, toCastPeople, toCrewDepartments } from './cast-crew.mapper';
import { EpisodeDetailStoreService } from '../episode-detail-store.service';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameMediaTarget } from '../media-target';

export type CreditSection = 'all' | 'cast' | 'crew';

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
    /** Stable id for the department heading and its expand action. */
    readonly id: string;
    readonly name: string;
    readonly people: readonly CreditPerson[];
}

interface MediaCastPageState {
    /** On an episode's cast route the page lists that episode's credits instead of the series'. */
    readonly isEpisode: boolean;
    readonly section: CreditSection;
    readonly query: string;
    readonly showAllCast: boolean;
    readonly expandedDepartments: readonly string[];
}

const CAST_PREVIEW_COUNT = 24;
const DEPARTMENT_PREVIEW_COUNT = 6;
const INITIAL_STATE: MediaCastPageState = {
    isEpisode: false,
    section: 'all',
    query: '',
    showAllCast: false,
    expandedDepartments: [],
};

@Injectable()
export class MediaCastPageStoreService extends ComponentStore<MediaCastPageState> {
    readonly castCrew$ = this.select(
        this.state$,
        this.mediaStoreService.mediaDetails$,
        this.mediaCreditsStoreService.creditsState$,
        this.episodeDetailStoreService.episodeCast$,
        ({ isEpisode, section, query, showAllCast, expandedDepartments }, media, seriesCredits, episodeCast) => {
            const credits = isEpisode ? episodeCast.credits : seriesCredits;
            const resource = remoteData(credits, { cast: [], crew: [] });
            const castPeople = toCastPeople(resource.cast);
            const departments = toCrewDepartments(resource.crew);
            const crewCount = countCrewPeople(departments);
            const hasBoth = castPeople.length > 0 && departments.length > 0;
            const activeSection: CreditSection = hasBoth ? section : castPeople.length ? 'cast' : 'crew';
            const normalizedQuery = query.trim().toLocaleLowerCase();
            const isFiltering = normalizedQuery.length > 0;
            const matchingCast = filterCreditPeople(castPeople, normalizedQuery);
            const visibleDepartments = departments
                .map((department) => {
                    const people = filterCreditPeople(department.people, normalizedQuery);
                    const isCollapsed =
                        !isFiltering &&
                        !expandedDepartments.includes(department.id) &&
                        people.length > DEPARTMENT_PREVIEW_COUNT;

                    return {
                        id: department.id,
                        name: department.name,
                        countLabel: `${people.length}`,
                        people: isCollapsed ? people.slice(0, DEPARTMENT_PREVIEW_COUNT) : people,
                        showMore: isCollapsed,
                        moreLabel: `All ${people.length} in ${department.name}`,
                    };
                })
                .filter((department) => department.people.length > 0);
            const isCastCollapsed = !isFiltering && !showAllCast && matchingCast.length > CAST_PREVIEW_COUNT;
            const showCast = activeSection !== 'crew' && matchingCast.length > 0;
            const showCrew = activeSection !== 'cast' && visibleDepartments.length > 0;
            const showLoading = credits.state === 'loading';

            return {
                media,
                header: isEpisode
                    ? {
                          backLink: episodeCast.header.episodeLink,
                          backLabel: episodeCast.header.backLabel,
                          imagePath: episodeCast.header.stillPath,
                          imageLink: episodeCast.header.episodeLink,
                          isLandscapeImage: true,
                          metaText: episodeCast.header.metaText,
                          showTabs: false,
                      }
                    : {
                          backLink: null,
                          backLabel: null,
                          imagePath: undefined,
                          imageLink: null,
                          isLandscapeImage: false,
                          metaText: null,
                          showTabs: true,
                      },
                showLoading,
                isEmpty: credits.state === 'success' && castPeople.length === 0 && departments.length === 0,
                query,
                showSections: hasBoth,
                sectionOptions: [
                    { label: 'Everyone', value: 'all' },
                    { label: `Cast (${castPeople.length})`, value: 'cast' },
                    { label: `Crew (${crewCount})`, value: 'crew' },
                ] satisfies SelectOption<CreditSection>[],
                section: activeSection,
                showCast,
                castCountLabel: isFiltering ? `${matchingCast.length} matching` : `${castPeople.length}`,
                cast: isCastCollapsed ? matchingCast.slice(0, CAST_PREVIEW_COUNT) : matchingCast,
                showAllCastButton: isCastCollapsed,
                allCastLabel: `Show all ${castPeople.length} cast`,
                showCrew,
                crewCountLabel: isFiltering
                    ? `${visibleDepartments.reduce((sum, department) => sum + department.people.length, 0)} matching`
                    : `${crewCount}`,
                departments: visibleDepartments,
                noMatchesText: showLoading || showCast || showCrew ? null : `No one matches “${query.trim()}”.`,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly episodeDetailStoreService: EpisodeDetailStoreService,
        private readonly mediaCreditsStoreService: MediaCreditsStoreService,
        private readonly mediaStoreService: MediaStoreService,
    ) {
        super(INITIAL_STATE);
    }

    /** The series' credits, or one episode's when the route names an episode. */
    load$(paramMap$: Observable<ParamMap>): Observable<unknown> {
        return paramMap$.pipe(
            map((paramMap) => paramMap.has('episodeNumber')),
            distinctUntilChanged(),
            switchMap((isEpisode) => {
                if (isEpisode) {
                    this.setState({ ...INITIAL_STATE, isEpisode });
                    return this.episodeDetailStoreService.loadCast$(paramMap$);
                }

                return this.mediaStoreService.currentTarget$.pipe(
                    distinctUntilChanged(isSameMediaTarget),
                    switchMap((target) => {
                        // The filters start over for a new title.
                        this.setState(INITIAL_STATE);
                        return this.mediaCreditsStoreService.load$(target);
                    }),
                );
            }),
        );
    }

    setSection(section: CreditSection): void {
        this.patchState({ section });
    }

    setQuery(query: string): void {
        this.patchState({ query });
    }

    showAllCast(): void {
        this.patchState({ showAllCast: true });
    }

    expandDepartment(departmentId: string): void {
        this.patchState((state) => ({ expandedDepartments: [...state.expandedDepartments, departmentId] }));
    }
}
