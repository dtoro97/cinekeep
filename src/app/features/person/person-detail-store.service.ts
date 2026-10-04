import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import type {
    Person,
    PersonCombinedCastCredit,
    PersonCombinedCredits,
    PersonCombinedCrewCredit,
    PersonExternalIds,
    PersonImages,
    TaggedImagePage,
} from '../../api';
import { PersonRestControllerService } from '../../api';
import { EMPTY, catchError, filter, map, of, switchMap, tap } from 'rxjs';
import {
    CardItem,
    ExternalLinks,
    RemoteData,
    LocaleStoreService,
    MEDIA_TYPE_OPTION,
    MediaType,
    SelectOption,
    SortDirection,
    ViewerImage,
    buildExternalLinks,
    compareValues,
    isPreferredImageLanguage,
    toRating,
} from '../../shared';
import { CAROUSEL_COUNT } from '../../constants';

export interface PersonCreditRow {
    id: number;
    title: string;
    mediaType: MediaType;
    releaseDate: string | null;
    year: string;
    rating: number | null;
    voteCount: number;
    posterPath: string | null;
    backdropPath: string | null;
    roleLabel: string;
    episodeCount: number;
    episodeLabel: string | null;
    mediaTypeLabel: string;
}

export interface PersonWithExternalIds extends Person {
    external_ids?: PersonExternalIds;
    images?: PersonImages;
    tagged_images?: TaggedImagePage;
}

export interface PersonCreditsState {
    acting: PersonCreditRow[];
    production: PersonCreditRow[];
}

export type PersonCreditsMediaType = 'all' | MediaType;
export type PersonCreditsSortBy = 'year' | 'rating' | 'title';

export interface PersonCreditsUiState {
    mediaType: PersonCreditsMediaType;
    sortBy: PersonCreditsSortBy;
    sortDirection: SortDirection;
    actingExpanded: boolean;
    productionExpanded: boolean;
}

export interface PersonDetailVm {
    person: RemoteData<PersonWithExternalIds | null>;
    externalLinks: ExternalLinks | null;
    /** "Alternative name" or "Alternative names", matching the person's alias count. */
    aliasesLabel: string;
    knownFor: RemoteData<CardItem[]>;
    photos: RemoteData<ViewerImage[]>;
    credits: RemoteData<PersonCreditsState>;
    creditsUi: PersonCreditsUiState;
    creditsDisplay: RemoteData<{
        totalCount: number;
        hasActiveFilters: boolean;
        emptyTitle: string;
        emptyText: string;
        mediaOptions: SelectOption<PersonCreditsMediaType>[];
        acting: {
            totalCount: number;
            hiddenCount: number;
            expanded: boolean;
            toggleLabel: string;
            rows: PersonCreditRow[];
        };
        production: {
            totalCount: number;
            hiddenCount: number;
            expanded: boolean;
            toggleLabel: string;
            rows: PersonCreditRow[];
        };
    }>;
}

interface PersonDetailState {
    person: RemoteData<PersonWithExternalIds | null>;
    photos: RemoteData<ViewerImage[]>;
    credits: RemoteData<PersonCreditsState>;
    creditsUi: PersonCreditsUiState;
}

const INITIAL_CREDITS_UI: PersonCreditsUiState = {
    mediaType: 'all',
    sortBy: 'year',
    sortDirection: 'desc',
    actingExpanded: false,
    productionExpanded: false,
};

const INITIAL_STATE: PersonDetailState = {
    person: { state: 'notAsked' },
    photos: { state: 'notAsked' },
    credits: { state: 'notAsked' },
    creditsUi: INITIAL_CREDITS_UI,
};

@Injectable()
export class PersonDetailStoreService extends ComponentStore<PersonDetailState> {
    personDetailVm$ = this.select(
        (state): PersonDetailVm => ({
            person: state.person,
            externalLinks: this.buildPersonExternalLinks(state.person),
            aliasesLabel:
                state.person.state === 'success' && state.person.data?.also_known_as?.length === 1
                    ? 'Alternative name'
                    : 'Alternative names',
            knownFor: this.buildKnownFor(state.person, state.credits),
            photos: state.photos,
            credits: state.credits,
            creditsUi: state.creditsUi,
            creditsDisplay: this.buildCreditsDisplay(state.credits, state.creditsUi),
        }),
    );

    /** The loaded person and up to three known-for titles, for page metadata. */
    readonly seoSource$ = this.personDetailVm$.pipe(
        map((vm) => ({
            person: vm.person.state === 'success' ? vm.person.data : null,
            knownForTitles:
                vm.knownFor.state === 'success'
                    ? vm.knownFor.data
                          .map((item) => item.title)
                          .filter(Boolean)
                          .slice(0, 3)
                    : [],
        })),
        filter(
            (source): source is { readonly person: PersonWithExternalIds; readonly knownForTitles: string[] } =>
                !!source.person,
        ),
    );

    constructor(
        private personRestControllerService: PersonRestControllerService,
        private localStore: LocaleStoreService,
        private router: Router,
    ) {
        super(INITIAL_STATE);
    }

    getPersonDetails$(id: number) {
        const state = this.get();
        if (
            state.person.state === 'success' &&
            state.person.data?.id === id &&
            state.photos.state === 'success' &&
            state.credits.state === 'success'
        ) {
            return of(undefined);
        }

        this.patchState({
            person: { state: 'loading' },
            photos: { state: 'loading' },
            credits: { state: 'loading' },
            creditsUi: INITIAL_CREDITS_UI,
        });

        return this.personRestControllerService
            .personDetails({ personId: id, appendToResponse: 'external_ids,images,tagged_images' })
            .pipe(
                map((person) => person as PersonWithExternalIds),
                tap((person) => {
                    this.patchState({
                        person: { state: 'success', data: person },
                    });

                    this.patchPhotosFromPerson(person);
                }),
                switchMap(() => this.loadCredits$(id)),
                catchError(() => {
                    this.router.navigate(['not-found']);
                    return EMPTY;
                }),
            );
    }

    private loadCredits$(id: number) {
        return this.personRestControllerService
            .personCombinedCredits({ personId: String(id) })
            .pipe(
                catchError(() => of({ cast: [], crew: [] } as PersonCombinedCredits)),
                tap((raw) => {
                    this.patchState({
                        credits: {
                            state: 'success',
                            data: this.buildCredits(raw),
                        },
                    });
                }),
            );
    }

    private patchPhotosFromPerson(person: PersonWithExternalIds): void {
        const tagged = person.tagged_images?.results ?? [];
        const profiles = person.images?.profiles ?? [];
        const language = this.localStore.language() || 'en';
        const images = [
            ...profiles.map(
                (img): ViewerImage => ({
                    ...img,
                    photoType: 'profile',
                }),
            ),
            ...tagged
                .filter((img) => isPreferredImageLanguage(img.iso_639_1, language))
                .map(
                    (img): ViewerImage => ({
                        file_path: img.file_path,
                        aspect_ratio: img.aspect_ratio,
                        height: img.height,
                        width: img.width,
                        vote_average: img.vote_average,
                        vote_count: img.vote_count,
                        iso_639_1: img.iso_639_1,
                        caption:
                            (img.media as { title?: string; name?: string })?.title ??
                            (img.media as { name?: string })?.name,
                        photoType: 'tagged',
                    }),
                ),
        ];
        this.patchState({
            photos: {
                state: 'success',
                data: sortPersonPhotos(images),
            },
        });
    }

    setCreditsMediaType(mediaType: PersonCreditsMediaType): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...state.creditsUi,
                mediaType: this.hasCreditsForMediaType(state.credits, mediaType) ? mediaType : 'all',
            },
        }));
    }

    setCreditsSortBy(sortBy: PersonCreditsSortBy): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...state.creditsUi,
                sortBy,
            },
        }));
    }

    resetCreditsFilters(): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...INITIAL_CREDITS_UI,
            },
        }));
    }

    toggleCreditsSortDirection(): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...state.creditsUi,
                sortDirection: state.creditsUi.sortDirection === 'desc' ? 'asc' : 'desc',
            },
        }));
    }

    toggleActingCredits(): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...state.creditsUi,
                actingExpanded: !state.creditsUi.actingExpanded,
            },
        }));
    }

    toggleProductionCredits(): void {
        this.patchState((state) => ({
            ...state,
            creditsUi: {
                ...state.creditsUi,
                productionExpanded: !state.creditsUi.productionExpanded,
            },
        }));
    }

    private buildCredits(raw: PersonCombinedCredits): PersonCreditsState {
        return {
            acting: this.buildActingCredits(raw.cast ?? []),
            production: this.buildProductionCredits(raw.crew ?? []),
        };
    }

    private buildActingCredits(items: PersonCombinedCastCredit[]): PersonCreditRow[] {
        const byKey = new Map<string, PersonCreditRow>();

        for (const credit of items) {
            const seed = this.toCreditSeed(credit, credit.character);
            if (!seed) {
                continue;
            }

            const existing = byKey.get(seed.key);
            byKey.set(seed.key, existing ? this.mergeCreditRows(existing, seed.row) : seed.row);
        }

        return [...byKey.values()].sort((left, right) => this.compareRows(left, right, 'year', 'desc'));
    }

    private buildProductionCredits(items: PersonCombinedCrewCredit[]): PersonCreditRow[] {
        const byKey = new Map<string, PersonCreditRow>();

        for (const credit of items) {
            const seed = this.toCreditSeed(credit, credit.job);
            if (!seed) {
                continue;
            }

            const existing = byKey.get(seed.key);
            byKey.set(seed.key, existing ? this.mergeCreditRows(existing, seed.row) : seed.row);
        }

        return [...byKey.values()].sort((left, right) => this.compareRows(left, right, 'year', 'desc'));
    }

    private toCreditSeed(
        credit: PersonCombinedCastCredit | PersonCombinedCrewCredit,
        role: string | undefined,
    ): { key: string; row: PersonCreditRow } | null {
        const id = credit.id;
        const title = credit.title || credit.name;
        if (!id || !title) {
            return null;
        }

        const mediaType = this.getCreditMediaType(credit);
        const releaseDate = credit.release_date || credit.first_air_date || null;
        const episodeCount = mediaType === 'tv' ? (credit.episode_count ?? 0) : 0;
        const roleLabel = this.mergeRoleText('', role);

        return {
            key: `${mediaType}-${id}`,
            row: {
                id,
                title,
                mediaType,
                releaseDate,
                year: releaseDate?.slice(0, 4) || 'Unknown',
                rating: toRating(credit.vote_average),
                voteCount: credit.vote_count ?? 0,
                posterPath: credit.poster_path ?? null,
                backdropPath: credit.backdrop_path ?? null,
                roleLabel,
                episodeCount,
                episodeLabel: toEpisodeLabel(episodeCount),
                mediaTypeLabel: mediaType === 'tv' ? 'TV series' : 'Movie',
            },
        };
    }

    private mergeCreditRows(existing: PersonCreditRow, incoming: PersonCreditRow): PersonCreditRow {
        return {
            ...existing,
            releaseDate: existing.releaseDate ?? incoming.releaseDate,
            year: existing.releaseDate ? existing.year : incoming.year,
            rating: existing.voteCount >= incoming.voteCount ? existing.rating : incoming.rating,
            voteCount: Math.max(existing.voteCount, incoming.voteCount),
            posterPath: existing.posterPath ?? incoming.posterPath,
            backdropPath: existing.backdropPath ?? incoming.backdropPath,
            roleLabel: this.mergeRoleText(existing.roleLabel, incoming.roleLabel),
            episodeCount: Math.max(existing.episodeCount, incoming.episodeCount),
            episodeLabel: toEpisodeLabel(Math.max(existing.episodeCount, incoming.episodeCount)),
        };
    }

    private buildKnownFor(
        person: RemoteData<PersonWithExternalIds | null>,
        credits: RemoteData<PersonCreditsState>,
    ): RemoteData<CardItem[]> {
        if (person.state === 'loading' || credits.state === 'loading') {
            return { state: 'loading' };
        }

        if (person.state !== 'success' || credits.state !== 'success' || !person.data) {
            return { state: 'loading' };
        }

        const seed = person.data.known_for_department === 'Acting' ? credits.data.acting : credits.data.production;

        const cards: CardItem[] = [...seed]
            .sort((a, b) => b.voteCount - a.voteCount)
            .slice(0, CAROUSEL_COUNT * 2)
            .map((credit) => ({
                id: credit.id,
                mediaType: credit.mediaType,
                title: credit.title,
                imagePath: credit.posterPath,
                backdropPath: credit.backdropPath,
                rating: credit.rating,
                date: credit.releaseDate ?? '',
                overview: '',
                role: credit.roleLabel || undefined,
            }));

        return { state: 'success', data: cards };
    }

    private buildCreditsDisplay(credits: RemoteData<PersonCreditsState>, ui: PersonCreditsUiState) {
        if (credits.state !== 'success') {
            return { state: 'loading' } as const;
        }

        const acting = this.prepareCreditSection(credits.data.acting, ui, ui.actingExpanded);
        const production = this.prepareCreditSection(credits.data.production, ui, ui.productionExpanded);
        const hasActiveFilters =
            ui.mediaType !== INITIAL_CREDITS_UI.mediaType ||
            ui.sortBy !== INITIAL_CREDITS_UI.sortBy ||
            ui.sortDirection !== INITIAL_CREDITS_UI.sortDirection;

        return {
            state: 'success' as const,
            data: {
                totalCount: acting.totalCount + production.totalCount,
                hasActiveFilters,
                emptyTitle: hasActiveFilters ? 'No filmography matches these filters' : 'No filmography available yet',
                emptyText: hasActiveFilters
                    ? 'Try resetting the filters to bring back more titles.'
                    : 'We do not have any movie or TV series credits to show right now.',
                mediaOptions: this.buildMediaOptions(credits.data),
                acting,
                production,
            },
        };
    }

    private buildMediaOptions(credits: PersonCreditsState): SelectOption<PersonCreditsMediaType>[] {
        const hasMovies = this.hasMediaType(credits, 'movie');
        const hasTv = this.hasMediaType(credits, 'tv');
        const options: SelectOption<PersonCreditsMediaType>[] = [{ label: 'All media', value: 'all' }];

        if (hasMovies) {
            options.push(MEDIA_TYPE_OPTION.movie);
        }

        if (hasTv) {
            options.push(MEDIA_TYPE_OPTION.tv);
        }

        return options;
    }

    private hasCreditsForMediaType(
        credits: RemoteData<PersonCreditsState>,
        mediaType: PersonCreditsMediaType,
    ): boolean {
        if (mediaType === 'all') {
            return true;
        }

        return credits.state === 'success' && this.hasMediaType(credits.data, mediaType);
    }

    private hasMediaType(credits: PersonCreditsState, mediaType: MediaType): boolean {
        return (
            credits.acting.some((credit) => credit.mediaType === mediaType) ||
            credits.production.some((credit) => credit.mediaType === mediaType)
        );
    }

    private prepareCreditSection(
        rows: PersonCreditRow[],
        ui: PersonCreditsUiState,
        expanded: boolean,
    ): {
        totalCount: number;
        hiddenCount: number;
        expanded: boolean;
        toggleLabel: string;
        rows: PersonCreditRow[];
    } {
        const filtered = ui.mediaType === 'all' ? rows : rows.filter((row) => row.mediaType === ui.mediaType);
        const sorted = [...filtered].sort((left, right) => this.compareRows(left, right, ui.sortBy, ui.sortDirection));
        const visibleRows = expanded ? sorted : sorted.slice(0, 10);

        return {
            totalCount: sorted.length,
            hiddenCount: Math.max(sorted.length - visibleRows.length, 0),
            expanded,
            toggleLabel: expanded ? 'Show less' : 'Show all',
            rows: visibleRows,
        };
    }

    /** Missing ratings and dates sort last in either direction; ties fall back to vote count and title. */
    private compareRows(
        left: PersonCreditRow,
        right: PersonCreditRow,
        sortBy: PersonCreditsSortBy,
        direction: SortDirection,
    ): number {
        const leftValue = toCreditSortValue(left, sortBy);
        const rightValue = toCreditSortValue(right, sortBy);

        if (leftValue === null || rightValue === null) {
            return leftValue === rightValue ? left.title.localeCompare(right.title) : leftValue === null ? 1 : -1;
        }

        const result =
            compareValues(leftValue, rightValue) ||
            (sortBy === 'rating' ? left.voteCount - right.voteCount : 0) ||
            left.title.localeCompare(right.title);

        return direction === 'desc' ? -result : result;
    }

    private getCreditMediaType(credit: PersonCombinedCastCredit | PersonCombinedCrewCredit): MediaType {
        if (credit.media_type === 'tv' || (!credit.media_type && credit.first_air_date)) {
            return 'tv';
        }

        return 'movie';
    }

    private mergeRoleText(existing: string, incoming: string | undefined): string {
        const parts = [...existing.split(','), ...(incoming ?? '').split(',')]
            .map((part) => part.trim())
            .filter(Boolean);

        return [...new Set(parts)].join(', ');
    }

    private buildPersonExternalLinks(person: RemoteData<PersonWithExternalIds | null>): ExternalLinks | null {
        if (person.state !== 'success' || !person.data) {
            return null;
        }

        return buildExternalLinks({
            links: person.data.external_ids,
            homepage: person.data.homepage,
            imdbType: 'name',
        });
    }
}

const toEpisodeLabel = (episodeCount: number): string | null => (episodeCount ? `${episodeCount} ep` : null);

const toCreditSortValue = (row: PersonCreditRow, sortBy: PersonCreditsSortBy): string | number | null => {
    if (sortBy === 'title') {
        return row.title;
    }

    return sortBy === 'rating' ? row.rating : row.releaseDate;
};

function sortPersonPhotos(images: readonly ViewerImage[]): ViewerImage[] {
    const typeRank = (image: ViewerImage): number =>
        image.photoType === 'profile' ? 0 : image.photoType === 'tagged' ? 1 : 2;
    const resolution = (image: ViewerImage): number => (image.width ?? 0) * (image.height ?? 0);

    return [...images].sort(
        (left, right) =>
            typeRank(left) - typeRank(right) ||
            (right.vote_average ?? 0) - (left.vote_average ?? 0) ||
            (right.vote_count ?? 0) - (left.vote_count ?? 0) ||
            resolution(right) - resolution(left) ||
            (left.file_path ?? '').localeCompare(right.file_path ?? ''),
    );
}
