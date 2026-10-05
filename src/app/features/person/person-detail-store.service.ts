import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, distinctUntilChanged, EMPTY, filter, map, Observable, of, switchMap, tap } from 'rxjs';

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
import {
    buildExternalLinks,
    CardItem,
    compareValues,
    isDefined,
    LocaleStoreService,
    MEDIA_TYPE_LABEL,
    MEDIA_TYPE_OPTION,
    MediaType,
    RemoteData,
    remoteSuccess,
    SelectOption,
    SortDirection,
    toEpisodeLabel,
    toRating,
    ViewerImage,
} from '../../shared';

export type PersonDetail = Person & {
    external_ids?: PersonExternalIds;
    images?: PersonImages;
    tagged_images?: TaggedImagePage;
};

export interface PersonCredit {
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

export type PersonCreditMediaFilter = 'all' | MediaType;
export type PersonCreditSortBy = 'year' | 'rating' | 'title';
export type PersonCreditSectionKey = 'acting' | 'production';

export interface PersonCreditFilters {
    mediaType: PersonCreditMediaFilter;
    sortBy: PersonCreditSortBy;
    sortDirection: SortDirection;
}

export interface PersonCreditSection {
    key: PersonCreditSectionKey;
    title: string;
    roleHeading: string;
    totalCount: number;
    hasToggle: boolean;
    toggleLabel: string;
    credits: PersonCredit[];
}

export interface PersonFilmography {
    totalCount: number;
    hasActiveFilters: boolean;
    emptyTitle: string;
    emptyText: string;
    mediaOptions: Array<SelectOption<PersonCreditMediaFilter>>;
    sections: PersonCreditSection[];
}

interface PersonCredits {
    acting: PersonCredit[];
    production: PersonCredit[];
}

type ExpandedCreditSections = Record<PersonCreditSectionKey, boolean>;

interface PersonDetailState {
    person: RemoteData<PersonDetail>;
    photos: RemoteData<ViewerImage[]>;
    credits: RemoteData<PersonCredits>;
    creditFilters: PersonCreditFilters;
    expandedCreditSections: ExpandedCreditSections;
    isBiographyExpanded: boolean;
}

const PERSON_APPENDED_RESOURCES = 'external_ids,images,tagged_images';
const KNOWN_FOR_COUNT = 12;
const KNOWN_FOR_SEO_TITLE_COUNT = 3;
const CREDIT_PREVIEW_COUNT = 10;
const BIOGRAPHY_PREVIEW_LENGTH = 300;
const ALIAS_PREVIEW_COUNT = 3;

const DEFAULT_CREDIT_FILTERS: PersonCreditFilters = {
    mediaType: 'all',
    sortBy: 'year',
    sortDirection: 'desc',
};

const COLLAPSED_CREDIT_SECTIONS: ExpandedCreditSections = {
    acting: false,
    production: false,
};

const CREDIT_SECTIONS: ReadonlyArray<Pick<PersonCreditSection, 'key' | 'title' | 'roleHeading'>> = [
    { key: 'acting', title: 'Acting', roleHeading: 'Role' },
    { key: 'production', title: 'Production', roleHeading: 'Job' },
];

const PHOTO_TYPE_RANK: Record<string, number> = { profile: 0, tagged: 1 };

const INITIAL_STATE: PersonDetailState = {
    person: { state: 'notAsked' },
    photos: { state: 'notAsked' },
    credits: { state: 'notAsked' },
    creditFilters: DEFAULT_CREDIT_FILTERS,
    expandedCreditSections: COLLAPSED_CREDIT_SECTIONS,
    isBiographyExpanded: false,
};

@Injectable()
export class PersonDetailStoreService extends ComponentStore<PersonDetailState> {
    readonly personDetail$ = this.select(
        ({ person, photos, credits, creditFilters, expandedCreditSections, isBiographyExpanded }) => {
            const loadedPerson = person.state === 'success' ? person.data : null;
            const biography = loadedPerson?.biography;
            const aliases = loadedPerson?.also_known_as ?? [];
            const photoCount = photos.state === 'success' ? photos.data.length : 0;
            const photosLink = loadedPerson ? ['/name', loadedPerson.id ?? '', 'photos'] : null;
            const knownFor: RemoteData<CardItem[]> =
                loadedPerson && credits.state === 'success'
                    ? remoteSuccess(
                          [
                              ...(loadedPerson.known_for_department === 'Acting'
                                  ? credits.data.acting
                                  : credits.data.production),
                          ]
                              .sort((left, right) => right.voteCount - left.voteCount)
                              .slice(0, KNOWN_FOR_COUNT)
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
                              })),
                      )
                    : { state: 'loading' };

            let filmography: RemoteData<PersonFilmography> = { state: 'loading' };
            if (credits.state === 'success') {
                const sections = CREDIT_SECTIONS.map((section): PersonCreditSection => {
                    const isExpanded = expandedCreditSections[section.key];
                    const matching = credits.data[section.key]
                        .filter(
                            (credit) => creditFilters.mediaType === 'all' || credit.mediaType === creditFilters.mediaType,
                        )
                        .sort((left, right) => compareCredits(left, right, creditFilters));
                    const visible = isExpanded ? matching : matching.slice(0, CREDIT_PREVIEW_COUNT);

                    return {
                        ...section,
                        totalCount: matching.length,
                        hasToggle: isExpanded || visible.length < matching.length,
                        toggleLabel: isExpanded ? 'Show less' : 'Show all',
                        credits: visible,
                    };
                });
                const hasActiveFilters =
                    creditFilters.mediaType !== DEFAULT_CREDIT_FILTERS.mediaType ||
                    creditFilters.sortBy !== DEFAULT_CREDIT_FILTERS.sortBy ||
                    creditFilters.sortDirection !== DEFAULT_CREDIT_FILTERS.sortDirection;

                filmography = remoteSuccess({
                    totalCount: sections.reduce((total, section) => total + section.totalCount, 0),
                    hasActiveFilters,
                    emptyTitle: hasActiveFilters
                        ? 'No filmography matches these filters'
                        : 'No filmography available yet',
                    emptyText: hasActiveFilters
                        ? 'Try resetting the filters to bring back more titles.'
                        : 'We do not have any movie or TV series credits to show right now.',
                    mediaOptions: [
                        { label: 'All media', value: 'all' },
                        ...(hasMediaType(credits.data, 'movie') ? [MEDIA_TYPE_OPTION.movie] : []),
                        ...(hasMediaType(credits.data, 'tv') ? [MEDIA_TYPE_OPTION.tv] : []),
                    ],
                    sections: sections.filter((section) => section.totalCount > 0),
                });
            }

            return {
                person,
                personName: loadedPerson?.name ?? '',
                biography: biography
                    ? {
                          text: biography,
                          isCollapsible: biography.length > BIOGRAPHY_PREVIEW_LENGTH,
                          isExpanded: isBiographyExpanded,
                          toggleLabel: isBiographyExpanded ? 'Show less' : 'Read more',
                      }
                    : null,
                aliases: aliases.length
                    ? {
                          label: aliases.length === 1 ? 'Alternative name' : 'Alternative names',
                          visible: aliases.slice(0, ALIAS_PREVIEW_COUNT),
                          hiddenCount: Math.max(aliases.length - ALIAS_PREVIEW_COUNT, 0),
                      }
                    : null,
                externalLinks: loadedPerson
                    ? buildExternalLinks({
                          links: loadedPerson.external_ids,
                          homepage: loadedPerson.homepage,
                          imdbType: 'name',
                      })
                    : null,
                knownFor,
                showKnownFor:
                    knownFor.state === 'loading' || (knownFor.state === 'success' && knownFor.data.length > 0),
                photos,
                photoCount,
                showPhotos: photos.state === 'loading' || photoCount > 0,
                showPhotosLink: isDefined(photosLink) && photoCount > 0,
                photosLink,
                filmography,
                creditFilters,
            };
        },
    );

    readonly loadedPerson$: Observable<PersonDetail> = this.select((state) =>
        state.person.state === 'success' ? state.person.data : undefined,
    ).pipe(
        filter(isDefined),
        distinctUntilChanged((previous, current) => previous.id === current.id),
    );

    readonly seoSource$ = this.personDetail$.pipe(
        map(({ person, knownFor }) =>
            person.state === 'success'
                ? {
                      person: person.data,
                      knownForTitles:
                          knownFor.state === 'success'
                              ? knownFor.data
                                    .map((item) => item.title)
                                    .filter(Boolean)
                                    .slice(0, KNOWN_FOR_SEO_TITLE_COUNT)
                              : [],
                  }
                : undefined,
        ),
        filter(isDefined),
    );

    constructor(
        private personRestControllerService: PersonRestControllerService,
        private localeStoreService: LocaleStoreService,
        private router: Router,
    ) {
        super(INITIAL_STATE);
    }

    getPerson$(personId: number): Observable<unknown> {
        const { person, photos, credits } = this.get();
        if (
            person.state === 'success' &&
            person.data.id === personId &&
            photos.state === 'success' &&
            credits.state === 'success'
        ) {
            return EMPTY;
        }

        this.setState({
            ...INITIAL_STATE,
            person: { state: 'loading' },
            photos: { state: 'loading' },
            credits: { state: 'loading' },
        });

        return this.personRestControllerService
            .personDetails({ personId, appendToResponse: PERSON_APPENDED_RESOURCES })
            .pipe(
                map((person) => person as PersonDetail),
                tap((person) => {
                    const language = this.localeStoreService.language();
                    const profiles = (person.images?.profiles ?? []).map(
                        (image): ViewerImage => ({ ...image, photoType: 'profile' }),
                    );
                    const tagged = (person.tagged_images?.results ?? [])
                        // English and language-neutral (`null`) images suit every locale.
                        .filter(({ iso_639_1 }) => iso_639_1 === null || iso_639_1 === 'en' || iso_639_1 === language)
                        .map((image): ViewerImage => {
                            const media = image.media as { title?: string; name?: string } | undefined;

                            return {
                                file_path: image.file_path,
                                aspect_ratio: image.aspect_ratio,
                                height: image.height,
                                width: image.width,
                                vote_average: image.vote_average,
                                vote_count: image.vote_count,
                                iso_639_1: image.iso_639_1,
                                caption: media?.title ?? media?.name,
                                photoType: 'tagged',
                            };
                        });
                    const typeRank = (image: ViewerImage): number =>
                        PHOTO_TYPE_RANK[image.photoType ?? ''] ?? Object.keys(PHOTO_TYPE_RANK).length;
                    const resolution = (image: ViewerImage): number => (image.width ?? 0) * (image.height ?? 0);

                    this.patchState({
                        person: remoteSuccess(person),
                        photos: remoteSuccess(
                            [...profiles, ...tagged].sort(
                                (left, right) =>
                                    typeRank(left) - typeRank(right) ||
                                    (right.vote_average ?? 0) - (left.vote_average ?? 0) ||
                                    (right.vote_count ?? 0) - (left.vote_count ?? 0) ||
                                    resolution(right) - resolution(left) ||
                                    (left.file_path ?? '').localeCompare(right.file_path ?? ''),
                            ),
                        ),
                    });
                }),
                switchMap(() =>
                    this.personRestControllerService.personCombinedCredits({ personId: String(personId) }).pipe(
                        // The biography and photos are still worth showing, so a failure leaves an empty filmography.
                        catchError(() => of<PersonCombinedCredits>({ cast: [], crew: [] })),
                    ),
                ),
                tap(({ cast, crew }) =>
                    this.patchState({
                        credits: remoteSuccess({
                            acting: mergeCreditsByTitle(
                                (cast ?? []).map((credit) => toPersonCredit(credit, credit.character)),
                            ),
                            production: mergeCreditsByTitle((crew ?? []).map((credit) => toPersonCredit(credit, credit.job))),
                        }),
                    }),
                ),
                // A person that cannot be loaded has no page to show.
                catchError(() => {
                    this.router.navigate(['not-found']);
                    return EMPTY;
                }),
            );
    }

    toggleBiography(): void {
        this.patchState((state) => ({ isBiographyExpanded: !state.isBiographyExpanded }));
    }

    setCreditMediaType(mediaType: PersonCreditMediaFilter): void {
        this.patchState(({ credits, creditFilters }) => ({
            creditFilters: {
                ...creditFilters,
                mediaType:
                    mediaType === 'all' || (credits.state === 'success' && hasMediaType(credits.data, mediaType))
                        ? mediaType
                        : 'all',
            },
        }));
    }

    setCreditSortBy(sortBy: PersonCreditSortBy): void {
        this.patchState((state) => ({ creditFilters: { ...state.creditFilters, sortBy } }));
    }

    toggleCreditSortDirection(): void {
        this.patchState((state) => ({
            creditFilters: {
                ...state.creditFilters,
                sortDirection: state.creditFilters.sortDirection === 'desc' ? 'asc' : 'desc',
            },
        }));
    }

    toggleCreditSection(section: PersonCreditSectionKey): void {
        this.patchState((state) => ({
            expandedCreditSections: {
                ...state.expandedCreditSections,
                [section]: !state.expandedCreditSections[section],
            },
        }));
    }

    resetCreditFilters(): void {
        this.patchState({
            creditFilters: DEFAULT_CREDIT_FILTERS,
            expandedCreditSections: COLLAPSED_CREDIT_SECTIONS,
        });
    }
}

function hasMediaType(credits: PersonCredits, mediaType: MediaType): boolean {
    return [...credits.acting, ...credits.production].some((credit) => credit.mediaType === mediaType);
}

function compareCredits(
    left: PersonCredit,
    right: PersonCredit,
    { sortBy, sortDirection }: Pick<PersonCreditFilters, 'sortBy' | 'sortDirection'>,
): number {
    const toSortValue = (credit: PersonCredit): string | number | null =>
        sortBy === 'title' ? credit.title : sortBy === 'rating' ? credit.rating : credit.releaseDate;
    const leftValue = toSortValue(left);
    const rightValue = toSortValue(right);

    if (leftValue === null || rightValue === null) {
        if (leftValue === rightValue) {
            return left.title.localeCompare(right.title);
        }
        return leftValue === null ? 1 : -1;
    }

    const result =
        compareValues(leftValue, rightValue) ||
        (sortBy === 'rating' ? left.voteCount - right.voteCount : 0) ||
        left.title.localeCompare(right.title);

    return sortDirection === 'desc' ? -result : result;
}

function mergeCreditsByTitle(credits: Array<PersonCredit | null>): PersonCredit[] {
    const creditsByTitle = new Map<string, PersonCredit>();

    for (const incoming of credits.filter(isDefined)) {
        const key = `${incoming.mediaType}-${incoming.id}`;
        const existing = creditsByTitle.get(key);
        const episodeCount = Math.max(existing?.episodeCount ?? 0, incoming.episodeCount);

        creditsByTitle.set(
            key,
            existing
                ? {
                      ...existing,
                      releaseDate: existing.releaseDate ?? incoming.releaseDate,
                      year: existing.releaseDate ? existing.year : incoming.year,
                      rating: existing.voteCount >= incoming.voteCount ? existing.rating : incoming.rating,
                      voteCount: Math.max(existing.voteCount, incoming.voteCount),
                      posterPath: existing.posterPath ?? incoming.posterPath,
                      backdropPath: existing.backdropPath ?? incoming.backdropPath,
                      roleLabel: mergeRoles(existing.roleLabel, incoming.roleLabel),
                      episodeCount,
                      episodeLabel: toEpisodeLabel(episodeCount),
                  }
                : incoming,
        );
    }

    return [...creditsByTitle.values()].sort((left, right) => compareCredits(left, right, DEFAULT_CREDIT_FILTERS));
}

function toPersonCredit(
    credit: PersonCombinedCastCredit | PersonCombinedCrewCredit,
    role: string | undefined,
): PersonCredit | null {
    const title = credit.title || credit.name;
    if (!credit.id || !title) {
        return null;
    }

    // TMDb leaves the media type out on some credits; only TV credits carry a first air date.
    const mediaType: MediaType =
        credit.media_type === 'tv' || (!credit.media_type && credit.first_air_date) ? 'tv' : 'movie';
    const releaseDate = credit.release_date || credit.first_air_date || null;
    const episodeCount = mediaType === 'tv' ? (credit.episode_count ?? 0) : 0;

    return {
        id: credit.id,
        title,
        mediaType,
        releaseDate,
        year: releaseDate?.slice(0, 4) || 'Unknown',
        rating: toRating(credit.vote_average),
        voteCount: credit.vote_count ?? 0,
        posterPath: credit.poster_path ?? null,
        backdropPath: credit.backdrop_path ?? null,
        roleLabel: mergeRoles('', role),
        episodeCount,
        episodeLabel: toEpisodeLabel(episodeCount),
        mediaTypeLabel: MEDIA_TYPE_LABEL[mediaType],
    };
}

function mergeRoles(existing: string, incoming: string | undefined): string {
    const roles = [...existing.split(','), ...(incoming ?? '').split(',')].map((role) => role.trim()).filter(Boolean);

    return [...new Set(roles)].join(', ');
}
