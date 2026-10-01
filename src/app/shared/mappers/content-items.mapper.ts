import { CollectionPart, MultiListItem } from '../../api';
import type { MediaType, RemoteData } from '../types';
import { mapRemoteData } from '../utils/remote-data';
import {
    CardItem,
    KnownForLink,
    PersonCardItem,
    VideoTrailerSeedItem,
    MediaListEntry,
    MediaListItem,
    PersonListItem,
    SearchResultItem,
} from '../models';

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

const toKnownForText = (knownForLinks: KnownForLink[]): string | undefined => {
    if (!knownForLinks.length) {
        return undefined;
    }
    return knownForLinks.map((item) => item.title).join(', ');
};

const toVideoTrailerSeed = (
    item: {
        id?: number | null;
        overview?: string | null;
        poster_path?: string | null;
        backdrop_path?: string | null;
    },
    mediaType: MediaType,
    mediaTitle: string | null | undefined,
    mediaDate: string | null | undefined,
): VideoTrailerSeedItem => ({
    mediaId: item.id ?? 0,
    mediaType,
    mediaTitle: mediaTitle ?? '',
    mediaYear: toDateValue(mediaDate, 'year'),
    mediaOverview: item.overview ?? '',
    mediaPosterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
});

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
        rating: item.vote_average ?? null,
        date: toDateValue(date, datePrecision),
        mediaType,
        genreIds: item.genre_ids ?? [],
        voteCount: item.vote_count ?? 0,
    };
};

export const toCollectionPartMediaListItem = (
    item: CollectionPart,
    datePrecision: DatePrecision = 'full',
): MediaListItem =>
    toMediaListItem(
        {
            id: item.id,
            poster_path: item.poster_path,
            title: item.title,
            overview: item.overview,
            vote_average: item.vote_average,
            vote_count: item.vote_count,
            release_date: item.release_date,
        },
        'movie',
        datePrecision,
    );

export const toMediaListEntryState = (
    state: RemoteData<MediaListItem[]>,
    genreMap: ReadonlyMap<number, string> = EMPTY_GENRE_MAP,
): RemoteData<MediaListEntry[]> => mapRemoteData(state, (items) => toMediaListEntries(items, genreMap));

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
            .slice(0, 3),
        routerLink: ['/title', item.id, item.mediaType],
    }));

export const toPersonListItem = (person: PersonLike): PersonListItem => ({
    id: person.id ?? 0,
    thumb: person.profile_path ?? null,
    title: person.name ?? '',
    department: person.known_for_department ?? '',
    knownForLinks: toKnownForLinks(person.known_for),
});

export const toPersonCardItem = (person: PersonLike): PersonCardItem => ({
    id: person.id ?? 0,
    name: person.name ?? '',
    imagePath: person.profile_path ?? null,
    subtitle: person.known_for_department ?? '',
});

export const toCastPersonCardItem = (person: CastLike): PersonCardItem => ({
    id: person.id ?? 0,
    name: person.name ?? '',
    imagePath: person.profile_path ?? null,
    subtitle: person.character ?? '',
});

export const mediaToSearchResultItem = (
    item: MediaItemLike,
    mediaType: MediaType,
): SearchResultItem => ({
    ...toMediaListItem(item, mediaType, 'year'),
    year: toDateValue(extractMediaFields(item, mediaType).date, 'year'),
    mediaType,
    mediaTypeLabel: toSearchResultMediaTypeLabel(mediaType),
    department: '',
});

export const personToSearchResultItem = (
    person: PersonLike,
): SearchResultItem => {
    const knownForLinks = toKnownForLinks(person.known_for);
    return {
        id: person.id ?? 0,
        thumb: person.profile_path ?? null,
        title: person.name ?? '',
        year: '',
        mediaType: 'person',
        mediaTypeLabel: toSearchResultMediaTypeLabel('person'),
        overview: '',
        rating: null,
        department: person.known_for_department ?? '',
        known_for: toKnownForText(knownForLinks),
    };
};

export const multiToSearchResultItem = (
    item: MultiListItem,
): SearchResultItem => {
    const knownForLinks = toKnownForLinks(item.known_for);
    return {
        id: item.id ?? 0,
        thumb: item.poster_path || item.profile_path || null,
        title: item.title || item.name || '',
        year: toDateValue(item.release_date || item.first_air_date, 'year'),
        mediaType: item.media_type || 'movie',
        mediaTypeLabel: toSearchResultMediaTypeLabel(item.media_type || 'movie'),
        overview: item.overview || '',
        rating: item.vote_average ?? null,
        department: item.known_for_department || '',
        known_for: toKnownForText(knownForLinks),
    };
};

function toSearchResultMediaTypeLabel(mediaType: string): string {
    if (mediaType === 'movie') {
        return 'Movie';
    }

    if (mediaType === 'tv') {
        return 'TV series';
    }

    if (mediaType === 'person') {
        return 'Person';
    }

    return mediaType;
}

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
        rating: item.vote_average ?? null,
        date,
        overview: item.overview ?? '',
    };
};

export const toVideoTrailerSeedItem = (
    item: MediaItemLike,
    mediaType: MediaType,
): VideoTrailerSeedItem => {
    const { title, date } = extractMediaFields(item, mediaType);
    return toVideoTrailerSeed(item, mediaType, title, date);
};
