import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, forkJoin, map, Observable, tap } from 'rxjs';

import { SearchRestControllerService } from '../../../api';
import {
    MEDIA_TYPE_LABEL,
    MediaListItem,
    MediaOrPersonFilterType,
    MediaOrPersonType,
    PersonListItem,
    pluralize,
    toMediaListItem,
    toPersonListItem,
    toTitleSegments,
} from '../../../shared';

interface SearchResultsByType {
    movie: MediaListItem;
    tv: MediaListItem;
    person: PersonListItem;
}

interface SearchResultsPage<T> {
    results: T[];
    page: number;
    totalPages: number;
    totalResults: number;
}

interface SearchSection<T> extends SearchResultsPage<T> {
    status: 'notAsked' | 'loading' | 'loading-more' | 'success';
}

type SearchSections = { [K in MediaOrPersonType]: SearchSection<SearchResultsByType[K]> };

interface SearchState {
    query: string;
    type: MediaOrPersonFilterType;
    sections: SearchSections;
}

const SECTION_KEYS: MediaOrPersonType[] = ['movie', 'tv', 'person'];
const TITLE_PREVIEW_COUNT = 5;
const PEOPLE_PREVIEW_COUNT = 6;

const SECTION_TITLES: Record<MediaOrPersonType, string> = {
    movie: 'Movies',
    tv: 'TV series',
    person: 'People',
};

const EMPTY_SECTION: SearchSection<never> = {
    status: 'notAsked',
    results: [],
    page: 0,
    totalPages: 0,
    totalResults: 0,
};

const INITIAL_STATE: SearchState = {
    query: '',
    type: 'all',
    sections: { movie: EMPTY_SECTION, tv: EMPTY_SECTION, person: EMPTY_SECTION },
};

@Injectable()
export class SearchStoreService extends ComponentStore<SearchState> {
    readonly query$ = this.select((state) => state.query);

    readonly searchPage$ = this.select(({ query, type, sections }) => {
        const hasQuery = query.length > 0;
        const isLoading = SECTION_KEYS.some((key) => sections[key].status === 'loading');
        const totals: Record<MediaOrPersonFilterType, number> = {
            all: SECTION_KEYS.reduce((total, key) => total + sections[key].totalResults, 0),
            movie: sections.movie.totalResults,
            tv: sections.tv.totalResults,
            person: sections.person.totalResults,
        };
        const toTitleRows = (results: MediaListItem[]) =>
            results.map((item) => ({
                id: item.id,
                mediaType: item.mediaType,
                titleSegments: toTitleSegments(item.title, query),
                thumb: item.thumb,
                meta: [item.date, MEDIA_TYPE_LABEL[item.mediaType]].filter(Boolean),
                overview: item.overview,
                rating: item.rating,
            }));
        const toPeopleRows = (results: PersonListItem[]) =>
            results.map((person) => ({
                id: person.id,
                nameSegments: toTitleSegments(person.name, query),
                imagePath: person.imagePath,
                initials: person.name
                    .split(/\s+/)
                    .map((word) => word.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toLocaleUpperCase(),
                meta: [
                    person.subtitle,
                    person.knownForLinks
                        .slice(0, 2)
                        .map((link) => link.title)
                        .join(', '),
                ]
                    .filter(Boolean)
                    .join(' · '),
            }));
        const toSection = (key: MediaOrPersonType, isPreview: boolean) => {
            const section = sections[key];
            const previewCount = key === 'person' ? PEOPLE_PREVIEW_COUNT : TITLE_PREVIEW_COUNT;
            const limit = <T>(items: T[]): T[] => (isPreview ? items.slice(0, previewCount) : items);
            const titleRows = key === 'person' ? [] : toTitleRows(limit(sections[key].results));
            const peopleRows = key === 'person' ? toPeopleRows(limit(sections.person.results)) : [];
            const shownCount = key === 'person' ? peopleRows.length : titleRows.length;

            return {
                key,
                headingId: `search-section-${key}`,
                title: SECTION_TITLES[key],
                isPeople: key === 'person',
                showSkeleton: section.status === 'loading',
                show: section.status === 'loading' || section.results.length > 0,
                titleRows,
                peopleRows,
                showJump: isPreview && section.totalResults > shownCount,
                jumpLabel: `All ${section.totalResults.toLocaleString('en-US')}`,
                showShowing: !isPreview && section.status !== 'loading',
                showingLabel: `${shownCount.toLocaleString('en-US')} of ${section.totalResults.toLocaleString('en-US')}`,
                showMore: !isPreview && section.page < section.totalPages,
                isLoadingMore: section.status === 'loading-more',
                moreLabel: `Show more ${SECTION_TITLES[key].toLocaleLowerCase()}`,
            };
        };
        const isAll = type === 'all';
        const hasNoResults = hasQuery && !isLoading && totals.all === 0;

        return {
            hasQuery,
            heading: hasQuery ? `“${query}”` : 'Search',
            totalLabel: isLoading ? '' : hasNoResults ? 'No results' : pluralize(totals.all, 'result'),
            showTabs: hasQuery && !hasNoResults,
            tabs: (['all', ...SECTION_KEYS] as MediaOrPersonFilterType[]).map((value) => ({
                value,
                label: value === 'all' ? 'All' : SECTION_TITLES[value],
                count: isLoading ? '' : totals[value].toLocaleString('en-US'),
            })),
            selectedType: type,
            railLabel: isAll ? 'People' : 'Other result types',
            mainSections: hasNoResults
                ? []
                : isAll
                  ? [toSection('movie', true), toSection('tv', true)].filter((section) => section.show)
                  : [toSection(type, false)],
            peopleRail: isAll && !hasNoResults ? toSection('person', true) : null,
            otherTypes: isAll
                ? []
                : SECTION_KEYS.filter((key) => key !== type).map((key) => ({
                      value: key,
                      label: SECTION_TITLES[key],
                      count: isLoading ? '' : totals[key].toLocaleString('en-US'),
                  })),
            otherTypesTitle: `Also for “${query}”`,
            hasNoResults,
        };
    });

    private readonly requests: {
        [K in MediaOrPersonType]: (
            query: string,
            page: number,
        ) => Observable<SearchResultsPage<SearchResultsByType[K]>>;
    } = {
        movie: (query, page) =>
            this.searchRestControllerService.searchMovie({ query, page }).pipe(
                map((response) =>
                    toResultsPage(response, page, (item) => toMediaListItem(item, 'movie', 'year')),
                ),
            ),
        tv: (query, page) =>
            this.searchRestControllerService.searchTv({ query, page }).pipe(
                map((response) =>
                    toResultsPage(response, page, (item) => toMediaListItem(item, 'tv', 'year')),
                ),
            ),
        person: (query, page) =>
            this.searchRestControllerService
                .searchPerson({ query, page })
                .pipe(map((response) => toResultsPage(response, page, (item) => toPersonListItem(item)))),
    };

    constructor(
        private searchRestControllerService: SearchRestControllerService,
        private router: Router,
        private activatedRoute: ActivatedRoute,
    ) {
        super(INITIAL_STATE);
    }

    search$(query: string, type: MediaOrPersonFilterType): Observable<unknown> {
        const trimmedQuery = query.trim();
        const state = this.get();

        // Every type is loaded for the counts, so switching tabs for the same query needs no request.
        if (trimmedQuery && trimmedQuery === state.query) {
            this.patchState({ type });
            return EMPTY;
        }

        const status = trimmedQuery ? 'loading' : 'notAsked';
        this.setState({
            query: trimmedQuery,
            type,
            sections: {
                movie: { ...EMPTY_SECTION, status },
                tv: { ...EMPTY_SECTION, status },
                person: { ...EMPTY_SECTION, status },
            },
        });

        return trimmedQuery ? forkJoin(SECTION_KEYS.map((key) => this.fetchPage$(key, trimmedQuery, 1))) : EMPTY;
    }

    loadMore$(key: MediaOrPersonType): Observable<unknown> {
        const { query, sections } = this.get();
        const section = sections[key];
        if (!query || section.status !== 'success' || section.page >= section.totalPages) {
            return EMPTY;
        }

        this.patchSection(key, (current) => ({ ...current, status: 'loading-more' }));
        return this.fetchPage$(key, query, section.page + 1);
    }

    setType(type: MediaOrPersonFilterType): void {
        const { query } = this.get();
        this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { query: query || undefined, type: type === 'all' ? undefined : type },
        });
    }

    private fetchPage$<K extends MediaOrPersonType>(key: K, query: string, page: number): Observable<unknown> {
        return this.requests[key](query, page).pipe(
            tap((response) =>
                this.patchSection(key, (current) => ({
                    status: 'success',
                    results: [...current.results, ...response.results],
                    page: response.page,
                    totalPages: response.totalPages,
                    totalResults: response.totalResults,
                })),
            ),
            // A failed first page leaves the type empty and hidden; a failed "show more" keeps what is listed.
            catchError(() => {
                this.patchSection(key, (current) => ({ ...current, status: 'success' }));
                return EMPTY;
            }),
        );
    }

    private patchSection<K extends MediaOrPersonType>(
        key: K,
        update: (section: SearchSection<SearchResultsByType[K]>) => SearchSection<SearchResultsByType[K]>,
    ): void {
        this.patchState((state) => ({ sections: { ...state.sections, [key]: update(state.sections[key]) } }));
    }
}

function toResultsPage<TItem, TResult>(
    response: { results?: TItem[]; page?: number; total_pages?: number; total_results?: number },
    requestedPage: number,
    toResult: (item: TItem) => TResult,
): SearchResultsPage<TResult> {
    return {
        results: (response.results ?? []).map((item) => toResult(item)),
        page: response.page ?? requestedPage,
        totalPages: response.total_pages ?? 0,
        totalResults: response.total_results ?? 0,
    };
}
