import type { RecentlyViewedItem, SearchResultItem } from '../../../models';
import type { RemoteData } from '../../../types';
import { toRating } from '../../../utils/rating';
import type {
    HeaderSearchGroup,
    HeaderSearchOption,
    HeaderSearchOptionKind,
    HeaderSearchPanel,
    HeaderSearchTitleSegment,
    SearchFilterValue,
} from './header-search.model';

const OPTION_ID_PREFIX = 'header-search-option';
const MAX_RECENT_OPTIONS = 5;
const MAX_TITLE_OPTIONS = 7;
const MAX_PEOPLE_OPTIONS = 3;
const MAX_SINGLE_TYPE_OPTIONS = 9;

export const HEADER_SEARCH_SEE_ALL_ID = `${OPTION_ID_PREFIX}-see-all`;

const KIND_LABELS: Readonly<Record<HeaderSearchOptionKind, string>> = {
    movie: 'Movie',
    tv: 'TV series',
    person: 'Person',
};

const PLACEHOLDERS: Readonly<Record<SearchFilterValue, string>> = {
    all: 'Search movies, TV series and people',
    movie: 'Search movies',
    tv: 'Search TV series',
    person: 'Search people',
};

const SINGLE_TYPE_GROUP_LABELS: Readonly<Record<Exclude<SearchFilterValue, 'all'>, string>> = {
    movie: 'Movies',
    tv: 'TV series',
    person: 'People',
};

const RECENT_LABEL = 'Recently viewed';
const RESULTS_LABEL = 'Search results';

const HIDDEN_PANEL: HeaderSearchPanel = { kind: 'hidden' };

export interface HeaderSearchPanelSource {
    readonly panelOpen: boolean;
    readonly query: string;
    readonly searchFilter: SearchFilterValue;
    readonly searchResultsState: RemoteData<readonly SearchResultItem[]>;
    readonly recentItems: readonly RecentlyViewedItem[];
}

export const toHeaderSearchPlaceholder = (filter: SearchFilterValue): string => PLACEHOLDERS[filter];

export const toSearchPageQueryParams = (query: string, filter: SearchFilterValue): Record<string, string> =>
    filter === 'all' ? { query } : { query, type: filter };

export const toHeaderSearchPanel = (source: HeaderSearchPanelSource): HeaderSearchPanel => {
    if (!source.panelOpen) {
        return HIDDEN_PANEL;
    }

    if (!source.query) {
        const options = source.recentItems.slice(0, MAX_RECENT_OPTIONS).map(recentToHeaderSearchOption);

        return options.length
            ? {
                  kind: 'recent',
                  label: RECENT_LABEL,
                  groups: [{ label: RECENT_LABEL, showLabel: true, options }],
              }
            : HIDDEN_PANEL;
    }

    switch (source.searchResultsState.state) {
        case 'notAsked':
            return HIDDEN_PANEL;
        case 'loading':
        case 'loading-more':
            return { kind: 'loading' };
        case 'failure':
            return { kind: 'error' };
        case 'success':
            return toResultsPanel(source, source.searchResultsState.data);
    }
};

export const toNavigableOptionIds = (panel: HeaderSearchPanel): string[] => {
    switch (panel.kind) {
        case 'recent':
            return panel.groups.flatMap((group) => group.options.map((option) => option.optionId));
        case 'results':
            return [
                panel.topHit.optionId,
                ...panel.groups.flatMap((group) => group.options.map((option) => option.optionId)),
                panel.seeAll.optionId,
            ];
        default:
            return [];
    }
};

export const findPanelOption = (panel: HeaderSearchPanel, optionId: string): HeaderSearchOption | null => {
    switch (panel.kind) {
        case 'recent':
            return panel.groups.flatMap((group) => group.options).find((option) => option.optionId === optionId) ?? null;
        case 'results':
            return (
                [panel.topHit, ...panel.groups.flatMap((group) => group.options)].find(
                    (option) => option.optionId === optionId,
                ) ?? null
            );
        default:
            return null;
    }
};

export const toHeaderSearchStatusMessage = (panel: HeaderSearchPanel): string => {
    switch (panel.kind) {
        case 'results': {
            const count = toNavigableOptionIds(panel).length - 1;
            return count === 1 ? '1 result' : `${count} results`;
        }
        case 'empty':
            return `No matches for ${panel.query}`;
        case 'error':
            return "Search isn't responding";
        default:
            return '';
    }
};

export const toTitleSegments = (title: string, query: string): HeaderSearchTitleSegment[] => {
    const needle = query.trim().toLocaleLowerCase();
    const haystack = title.toLocaleLowerCase();
    const start = needle ? haystack.indexOf(needle) : -1;

    // Lower-casing can change string length for a few scripts; skip highlighting rather than mis-slice.
    if (start < 0 || haystack.length !== title.length) {
        return [{ text: title, match: false }];
    }

    const end = start + needle.length;

    return [
        { text: title.slice(0, start), match: false },
        { text: title.slice(start, end), match: true },
        { text: title.slice(end), match: false },
    ].filter((segment) => segment.text.length > 0);
};

function toResultsPanel(source: HeaderSearchPanelSource, items: readonly SearchResultItem[]): HeaderSearchPanel {
    const options = items
        .map((item) => searchResultToHeaderSearchOption(item, source.query))
        .filter((option): option is HeaderSearchOption => option !== null);

    if (!options.length) {
        return {
            kind: 'empty',
            query: source.query,
            canWiden: source.searchFilter !== 'all',
        };
    }

    const [topHit, ...rest] = options;

    return {
        kind: 'results',
        label: RESULTS_LABEL,
        topHit,
        groups: toResultGroups(rest, source.searchFilter),
        seeAll: {
            optionId: HEADER_SEARCH_SEE_ALL_ID,
            query: source.query,
            queryParams: toSearchPageQueryParams(source.query, source.searchFilter),
        },
    };
}

function toResultGroups(options: readonly HeaderSearchOption[], filter: SearchFilterValue): HeaderSearchGroup[] {
    if (filter !== 'all') {
        return [
            {
                label: SINGLE_TYPE_GROUP_LABELS[filter],
                showLabel: false,
                options: options.slice(0, MAX_SINGLE_TYPE_OPTIONS),
            },
        ].filter((group) => group.options.length > 0);
    }

    const titles = options.filter((option) => option.kind !== 'person').slice(0, MAX_TITLE_OPTIONS);
    const people = options.filter((option) => option.kind === 'person').slice(0, MAX_PEOPLE_OPTIONS);

    return [
        {
            label: 'Titles',
            showLabel: false,
            options: titles,
        },
        {
            label: 'People',
            showLabel: false,
            options: people,
        },
    ].filter((group) => group.options.length > 0);
}

function searchResultToHeaderSearchOption(item: SearchResultItem, query: string): HeaderSearchOption | null {
    const kind = toOptionKind(item.mediaType);

    if (!kind || !item.id) {
        return null;
    }

    if (kind === 'person') {
        return toPersonOption({
            id: item.id,
            name: item.title,
            thumb: item.thumb,
            department: item.department,
            knownFor: item.known_for ?? '',
            query,
        });
    }

    return toTitleOption({
        id: item.id,
        kind,
        title: item.title,
        thumb: item.thumb,
        year: item.year,
        overview: item.overview,
        rating: toRating(item.rating),
        query,
    });
}

function recentToHeaderSearchOption(item: RecentlyViewedItem): HeaderSearchOption {
    if (item.kind === 'person') {
        return toPersonOption({
            id: item.id,
            name: item.name,
            thumb: item.imagePath,
            department: item.subtitle,
            knownFor: '',
            query: '',
            idPrefix: 'recent',
        });
    }

    return toTitleOption({
        id: item.id,
        kind: item.mediaType,
        title: item.title,
        thumb: item.imagePath,
        year: item.date ? item.date.slice(0, 4) : '',
        overview: item.overview,
        rating: toRating(item.rating),
        query: '',
        idPrefix: 'recent',
    });
}

function toTitleOption(input: {
    readonly id: number;
    readonly kind: 'movie' | 'tv';
    readonly title: string;
    readonly thumb: string | null;
    readonly year: string;
    readonly overview: string;
    readonly rating: number | null;
    readonly query: string;
    readonly idPrefix?: string;
}): HeaderSearchOption {
    const meta = [input.year, KIND_LABELS[input.kind]].filter(Boolean).join(' · ');

    return {
        optionId: toOptionId(input.kind, input.id, input.idPrefix),
        kind: input.kind,
        title: input.title,
        titleSegments: toTitleSegments(input.title, input.query),
        thumb: input.thumb,
        imageType: 'media',
        meta,
        compactMeta: meta,
        detail: input.overview,
        rating: input.rating,
        routeCommands: ['/title', input.id, input.kind],
    };
}

function toPersonOption(input: {
    readonly id: number;
    readonly name: string;
    readonly thumb: string | null;
    readonly department: string;
    readonly knownFor: string;
    readonly query: string;
    readonly idPrefix?: string;
}): HeaderSearchOption {
    const meta = input.department || KIND_LABELS.person;

    return {
        optionId: toOptionId('person', input.id, input.idPrefix),
        kind: 'person',
        title: input.name,
        titleSegments: toTitleSegments(input.name, input.query),
        thumb: input.thumb,
        imageType: 'person',
        meta,
        compactMeta: [meta, input.knownFor].filter(Boolean).join(' · '),
        detail: input.knownFor ? `Known for ${input.knownFor}` : '',
        rating: null,
        routeCommands: ['/name', input.id],
    };
}

function toOptionKind(mediaType: string): HeaderSearchOptionKind | null {
    return mediaType === 'movie' || mediaType === 'tv' || mediaType === 'person' ? mediaType : null;
}

function toOptionId(kind: HeaderSearchOptionKind, id: number, prefix = 'result'): string {
    return `${OPTION_ID_PREFIX}-${prefix}-${kind}-${id}`;
}
