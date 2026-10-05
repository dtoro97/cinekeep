import type { MediaType, RemoteData } from '../types';
import { mapRemoteData } from '../utils/remote-data';
import { toRating } from '../utils/rating';
import { CardItem, KnownForLink, MediaListEntry, MediaListItem, PersonCardItem, PersonListItem } from '../models';

type DatePrecision = 'year' | 'full';

const EMPTY_GENRE_MAP = new Map<number, string>();

type MediaItemLike = {
    id?: number | null;
    poster_path?: string | null;
    backdrop_path?: string | null;
    title?: string | null;
    name?: string | null;
    genre_ids?: number[] | null;
    release_date?: string | null;
    first_air_date?: string | null;
    overview?: string | null;
    vote_average?: number | null;
    vote_count?: number | null;
    popularity?: number | null;
};

type PersonKnownForLike = {
    id?: number | null;
    title?: string | null;
    name?: string | null;
    media_type?: string | null;
};

type PersonLike = {
    id?: number | null;
    profile_path?: string | null;
    name?: string | null;
    known_for_department?: string | null;
    known_for?: PersonKnownForLike[] | null;
};

type CastLike = {
    id?: number | null;
    profile_path?: string | null;
    name?: string | null;
    character?: string | null;
};

const toDateValue = (
    date: string | null | undefined,
    precision: DatePrecision,
): string => {
    const value = date ?? '';
    return precision === 'year' ? value.slice(0, 4) : value;
};

const extractMediaFields = (
    item: MediaItemLike,
    mediaType: MediaType,
): { title: string; date: string } => ({
    title: (mediaType === 'movie' ? item.title : item.name) ?? '',
    date:
        (mediaType === 'movie' ? item.release_date : item.first_air_date) ?? '',
});

const toKnownForLinks = (
    items: PersonKnownForLike[] | null | undefined,
): KnownForLink[] =>
    (items ?? [])
        .filter((item) => !!item.id && !!(item.title || item.name))
        .map((item) => ({
            id: item.id!,
            title: item.title || item.name || '',
            mediaType: (item.media_type || 'movie') as MediaType,
        }));

export const toMediaListItem = (
    item: MediaItemLike,
    mediaType: MediaType,
    datePrecision: DatePrecision = 'full',
): MediaListItem => {
    const { title, date } = extractMediaFields(item, mediaType);
    return {
        id: item.id ?? 0,
        thumb: item.poster_path ?? null,
        title,
        overview: item.overview ?? '',
        rating: toRating(item.vote_average),
        date: toDateValue(date, datePrecision),
        mediaType,
        genreIds: item.genre_ids ?? [],
    };
};

export const toMediaListEntryState = (
    state: RemoteData<MediaListItem[]>,
    genreMap: ReadonlyMap<number, string> = EMPTY_GENRE_MAP,
): RemoteData<MediaListEntry[]> => mapRemoteData(state, (items) => toMediaListEntries(items, genreMap));

// TMDb's long genre names crowd compact rows; IMDb-style short forms keep three on one line.
const SHORT_GENRE_NAMES: Readonly<Record<string, string>> = {
    'Science Fiction': 'Sci-Fi',
    'Sci-Fi & Fantasy': 'Sci-Fi',
    'Action & Adventure': 'Action',
    'War & Politics': 'War',
};

/** List rows with up to three genre names and a link to the title. */
export const toMediaListEntries = (
    items: readonly MediaListItem[],
    genreMap: ReadonlyMap<number, string> = EMPTY_GENRE_MAP,
): MediaListEntry[] =>
    items.map((item) => ({
        item,
        genreNames: (item.genreIds ?? [])
            .map((genreId) => genreMap.get(genreId))
            .filter((genreName): genreName is string => !!genreName)
            .map((genreName) => SHORT_GENRE_NAMES[genreName] ?? genreName)
            .slice(0, 3),
        routerLink: ['/title', item.id, item.mediaType],
    }));

export const toPersonListItem = (person: PersonLike): PersonListItem => ({
    ...toPersonCardItem(person),
    knownForLinks: toKnownForLinks(person.known_for),
});

export const toPersonCardItem = (person: PersonLike): PersonCardItem => ({
    id: person.id ?? 0,
    name: person.name ?? '',
    imagePath: person.profile_path ?? null,
    subtitle: person.known_for_department ?? '',
});

/** Department plus the best-known title, e.g. "Acting · Reacher". */
export const toKnownForPersonCardItem = (person: PersonLike): PersonCardItem => ({
    ...toPersonCardItem(person),
    subtitle: [person.known_for_department, toKnownForLinks(person.known_for)[0]?.title].filter(Boolean).join(' · '),
});

export const toCastPersonCardItem = (person: CastLike): PersonCardItem => ({
    ...toPersonCardItem(person),
    subtitle: person.character ?? '',
});

export const toCardItem = (
    item: MediaItemLike,
    mediaType: MediaType,
): CardItem => {
    const { title, date } = extractMediaFields(item, mediaType);
    return {
        id: item.id ?? 0,
        mediaType,
        title,
        imagePath: item.poster_path ?? null,
        backdropPath: item.backdrop_path ?? null,
        rating: toRating(item.vote_average),
        date,
        overview: item.overview ?? '',
    };
};

/** A list row's title as a poster card. */
export const mediaListItemToCardItem = (item: MediaListItem): CardItem => ({
    id: item.id,
    mediaType: item.mediaType,
    title: item.title,
    imagePath: item.thumb,
    backdropPath: null,
    rating: item.rating,
    date: item.date,
    overview: item.overview,
});
