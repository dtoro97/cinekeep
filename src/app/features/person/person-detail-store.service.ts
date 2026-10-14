import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { marked } from 'marked';
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
    isDefined,
    LocaleStoreService,
    MEDIA_TYPE_OPTION,
    MediaType,
    RemoteData,
    remoteSuccess,
    SelectOption,
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
    rating: number | null;
    voteCount: number;
    posterPath: string | null;
    backdropPath: string | null;
    roleLabel: string;
    episodeCount: number;
    episodeLabel: string | null;
}

export type PersonCreditMediaFilter = 'all' | MediaType;

export interface PersonCreditYear {
    label: string;
    isUpcoming: boolean;
    credits: PersonCredit[];
}

export interface PersonFilmography {
    totalLabel: string;
    departmentOptions: Array<SelectOption<string>>;
    selectedDepartment: string;
    showDepartments: boolean;
    mediaOptions: Array<SelectOption<PersonCreditMediaFilter>>;
    selectedMediaType: PersonCreditMediaFilter;
    showMediaTypes: boolean;
    years: PersonCreditYear[];
    hasCredits: boolean;
    hasToggle: boolean;
    toggleLabel: string;
}

interface PersonCreditDepartment {
    name: string;
    credits: PersonCredit[];
}

interface PersonBiography {
    previewHtml: string;
    fullHtml: string;
    isCollapsible: boolean;
}

interface PersonDetailState {
    person: RemoteData<PersonDetail>;
    biography: PersonBiography | null;
    photos: RemoteData<ViewerImage[]>;
    departments: RemoteData<PersonCreditDepartment[]>;
    selectedDepartment: string | null;
    mediaType: PersonCreditMediaFilter;
    isFilmographyExpanded: boolean;
    isBiographyExpanded: boolean;
}

const PERSON_APPENDED_RESOURCES = 'external_ids,images,tagged_images';
const ACTING_DEPARTMENT = 'Acting';
const KNOWN_FOR_COUNT = 6;
const KNOWN_FOR_SEO_TITLE_COUNT = 3;
const FILMOGRAPHY_PREVIEW_COUNT = 20;
const PHOTO_PREVIEW_COUNT = 6;
const BIOGRAPHY_PREVIEW_LENGTH = 300;
const ALIAS_PREVIEW_COUNT = 3;
const UPCOMING_LABEL = 'Upcoming';

const PHOTO_TYPE_RANK: Record<string, number> = { profile: 0, tagged: 1 };

const INITIAL_STATE: PersonDetailState = {
    person: { state: 'notAsked' },
    biography: null,
    photos: { state: 'notAsked' },
    departments: { state: 'notAsked' },
    selectedDepartment: null,
    mediaType: 'all',
    isFilmographyExpanded: false,
    isBiographyExpanded: false,
};

@Injectable()
export class PersonDetailStoreService extends ComponentStore<PersonDetailState> {
    readonly personDetail$ = this.select(
        ({
            person,
            biography,
            photos,
            departments,
            selectedDepartment,
            mediaType,
            isFilmographyExpanded,
            isBiographyExpanded,
        }) => {
            const loadedPerson = person.state === 'success' ? person.data : null;
            const aliases = loadedPerson?.also_known_as ?? [];
            const photoCount = photos.state === 'success' ? photos.data.length : 0;
            const photosLink = loadedPerson ? ['/name', loadedPerson.id ?? '', 'photos'] : null;
            const loadedDepartments = departments.state === 'success' ? departments.data : null;
            const activeDepartment = loadedDepartments
                ? (loadedDepartments.find(({ name }) => name === selectedDepartment) ??
                  findKnownForDepartment(loadedDepartments, loadedPerson))
                : undefined;

            const knownFor: RemoteData<CardItem[]> = loadedDepartments
                ? remoteSuccess(
                      [...(findKnownForDepartment(loadedDepartments, loadedPerson)?.credits ?? [])]
                          .sort((left, right) => right.voteCount - left.voteCount)
                          .slice(0, KNOWN_FOR_COUNT)
                          .map((credit) => ({
                              id: credit.id,
                              mediaType: credit.mediaType,
                              title: credit.title,
                              imagePath: credit.posterPath,
                              backdropPath: credit.backdropPath,
                              rating: credit.rating,
                              date: '',
                              overview: '',
                              role: credit.roleLabel || undefined,
                          })),
                  )
                : { state: 'loading' };

            let filmography: RemoteData<PersonFilmography> = { state: 'loading' };
            if (loadedDepartments) {
                const departmentCredits = activeDepartment?.credits ?? [];
                const hasMediaTypes =
                    departmentCredits.some((credit) => credit.mediaType === 'movie') &&
                    departmentCredits.some((credit) => credit.mediaType === 'tv');
                const activeMediaType = hasMediaTypes ? mediaType : 'all';
                const matching = departmentCredits.filter(
                    (credit) => activeMediaType === 'all' || credit.mediaType === activeMediaType,
                );
                const visible = isFilmographyExpanded ? matching : matching.slice(0, FILMOGRAPHY_PREVIEW_COUNT);
                const today = new Date().toISOString().slice(0, 10);
                const years = visible.reduce<PersonCreditYear[]>((groups, credit) => {
                    const label =
                        !credit.releaseDate || credit.releaseDate > today
                            ? UPCOMING_LABEL
                            : credit.releaseDate.slice(0, 4);
                    const last = groups.at(-1);
                    if (last?.label === label) {
                        last.credits.push(credit);
                    } else {
                        groups.push({ label, isUpcoming: label === UPCOMING_LABEL, credits: [credit] });
                    }
                    return groups;
                }, []);
                const totalCount = loadedDepartments.reduce((total, { credits }) => total + credits.length, 0);

                filmography = remoteSuccess({
                    totalLabel: `${totalCount} ${totalCount === 1 ? 'credit' : 'credits'}`,
                    departmentOptions: loadedDepartments.map(({ name, credits }) => ({
                        label: `${name} (${credits.length})`,
                        value: name,
                    })),
                    selectedDepartment: activeDepartment?.name ?? '',
                    showDepartments: loadedDepartments.length > 1,
                    mediaOptions: [
                        { label: 'All', value: 'all' },
                        MEDIA_TYPE_OPTION.movie,
                        { label: 'TV', value: 'tv' },
                    ],
                    selectedMediaType: activeMediaType,
                    showMediaTypes: hasMediaTypes,
                    years,
                    hasCredits: years.length > 0,
                    hasToggle: matching.length > FILMOGRAPHY_PREVIEW_COUNT,
                    toggleLabel: isFilmographyExpanded
                        ? 'Show less'
                        : `Show all ${matching.length} ${activeDepartment?.name.toLocaleLowerCase() ?? ''} credits`,
                });
            }

            return {
                person,
                personName: loadedPerson?.name ?? '',
                profilePath: loadedPerson?.profile_path ?? null,
                biography: biography
                    ? {
                          ...biography,
                          isExpanded: isBiographyExpanded,
                          showFull: isBiographyExpanded || !biography.isCollapsible,
                          toggleLabel: isBiographyExpanded ? 'Show less' : 'Read more',
                      }
                    : null,
                aliasesText: aliases.length
                    ? [
                          aliases.slice(0, ALIAS_PREVIEW_COUNT).join(', '),
                          aliases.length > ALIAS_PREVIEW_COUNT ? `+${aliases.length - ALIAS_PREVIEW_COUNT} more` : '',
                      ]
                          .filter(Boolean)
                          .join(' ')
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
                photoPreview:
                    photos.state === 'success'
                        ? photos.data.slice(0, PHOTO_PREVIEW_COUNT).map((image, index) => ({
                              image,
                              index,
                              ariaLabel: `Open photo ${index + 1} of ${photoCount}`,
                          }))
                        : [],
                photoCount,
                photoCountLabel: `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`,
                photosSubtitle:
                    loadedPerson && photos.state === 'success'
                        ? `${loadedPerson.name} · ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                        : null,
                showPhotosSkeleton: photos.state === 'loading',
                showPhotos: photoCount > 0,
                photosLink,
                filmography,
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
        const { person, photos, departments } = this.get();
        if (
            person.state === 'success' &&
            person.data.id === personId &&
            photos.state === 'success' &&
            departments.state === 'success'
        ) {
            return EMPTY;
        }

        this.setState({
            ...INITIAL_STATE,
            person: { state: 'loading' },
            photos: { state: 'loading' },
            departments: { state: 'loading' },
        });

        return this.personRestControllerService
            .personDetails({ personId, appendToResponse: PERSON_APPENDED_RESOURCES })
            .pipe(
                map((person) => person as PersonDetail),
                tap((person) => {
                    const language = this.localeStoreService.language();
                    const profiles = (person.images?.profiles ?? []).map((image): ViewerImage => ({
                        ...image,
                        photoType: 'profile',
                    }));
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

                    // TMDb biographies are Markdown: blank lines between paragraphs, `*Title*` for films.
                    const paragraphs = (person.biography ?? '')
                        .split(/\n\s*\n/)
                        .map((paragraph) => paragraph.trim())
                        .filter(Boolean);
                    const parseMarkdown = (markdown: string, inline: boolean): string => {
                        const rendered = inline
                            ? marked.parseInline(markdown, { breaks: true, gfm: true })
                            : marked.parse(markdown, { breaks: true, gfm: true });
                        return typeof rendered === 'string' ? rendered : markdown;
                    };

                    this.patchState({
                        person: remoteSuccess(person),
                        biography: paragraphs.length
                            ? {
                                  previewHtml: parseMarkdown(paragraphs[0], true),
                                  fullHtml: parseMarkdown(paragraphs.join('\n\n'), false),
                                  isCollapsible:
                                      paragraphs.length > 1 || paragraphs[0].length > BIOGRAPHY_PREVIEW_LENGTH,
                              }
                            : null,
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
                tap(({ cast, crew }) => {
                    const crewByDepartment = (crew ?? []).reduce<Record<string, PersonCombinedCrewCredit[]>>(
                        (groups, credit) => {
                            const department = credit.department || 'Crew';
                            return { ...groups, [department]: [...(groups[department] ?? []), credit] };
                        },
                        {},
                    );
                    const crewDepartments = Object.entries(crewByDepartment)
                        .map(([name, credits]) => ({
                            name,
                            credits: mergeCreditsByTitle(credits.map((credit) => toPersonCredit(credit, credit.job))),
                        }))
                        .sort((left, right) => right.credits.length - left.credits.length);
                    const acting = mergeCreditsByTitle(
                        (cast ?? []).map((credit) => toPersonCredit(credit, credit.character)),
                    );

                    this.patchState({
                        departments: remoteSuccess(
                            [{ name: ACTING_DEPARTMENT, credits: acting }, ...crewDepartments].filter(
                                ({ credits }) => credits.length > 0,
                            ),
                        ),
                    });
                }),
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

    setDepartment(selectedDepartment: string): void {
        this.patchState({ selectedDepartment, mediaType: 'all', isFilmographyExpanded: false });
    }

    setMediaType(mediaType: PersonCreditMediaFilter): void {
        this.patchState({ mediaType, isFilmographyExpanded: false });
    }

    toggleFilmography(): void {
        this.patchState((state) => ({ isFilmographyExpanded: !state.isFilmographyExpanded }));
    }
}

function findKnownForDepartment(
    departments: PersonCreditDepartment[],
    person: PersonDetail | null,
): PersonCreditDepartment | undefined {
    return departments.find(({ name }) => name === person?.known_for_department) ?? departments[0];
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

    // Upcoming and undated credits first, then newest to oldest.
    return [...creditsByTitle.values()].sort((left, right) => {
        if (!left.releaseDate || !right.releaseDate) {
            if (left.releaseDate === right.releaseDate) {
                return left.title.localeCompare(right.title);
            }
            return left.releaseDate ? 1 : -1;
        }

        return right.releaseDate.localeCompare(left.releaseDate) || left.title.localeCompare(right.title);
    });
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
    const episodeCount = mediaType === 'tv' ? (credit.episode_count ?? 0) : 0;

    return {
        id: credit.id,
        title,
        mediaType,
        releaseDate: credit.release_date || credit.first_air_date || null,
        rating: toRating(credit.vote_average),
        voteCount: credit.vote_count ?? 0,
        posterPath: credit.poster_path ?? null,
        backdropPath: credit.backdrop_path ?? null,
        roleLabel: mergeRoles('', role),
        episodeCount,
        episodeLabel: toEpisodeLabel(episodeCount),
    };
}

function mergeRoles(existing: string, incoming: string | undefined): string {
    const roles = [...existing.split(','), ...(incoming ?? '').split(',')].map((role) => role.trim()).filter(Boolean);

    return [...new Set(roles)].join(', ');
}
