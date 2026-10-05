import type { MediaListItem, PersonListItem, RecentlyViewedItem } from '../../../models';
import { MEDIA_TYPE_LABEL } from '../../../models/media-type-options.model';
import type { MediaOrPersonFilterType, MediaOrPersonType, MediaType, RemoteData } from '../../../types';
import { pluralize } from '../../../utils/pluralize';
import type { HeaderSearchOption, HeaderSearchPanel, HeaderSearchTitleSegment } from './header-search.model';

const OPTION_ID_PREFIX = 'header-search-option';
const MAX_RECENT_OPTIONS = 5;
const MAX_TITLE_OPTIONS = 7;
const MAX_PEOPLE_OPTIONS = 3;
const MAX_SINGLE_TYPE_OPTIONS = 9;

export const HEADER_SEARCH_SEE_ALL_ID = `${OPTION_ID_PREFIX}-see-all`;

const PLACEHOLDERS: Readonly<Record<MediaOrPersonFilterType, string>> = {
    all: 'Search movies, TV series and people',
    movie: 'Search movies',
    tv: 'Search TV series',
    person: 'Search people',
};

const SINGLE_TYPE_GROUP_LABELS: Readonly<Record<Exclude<MediaOrPersonFilterType, 'all'>, string>> = {
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
    readonly searchFilter: MediaOrPersonFilterType;
    /** Result options without highlighting; the panel highlights them for the current query. */
    readonly searchResultsState: RemoteData<readonly HeaderSearchOption[]>;
    readonly recentItems: readonly RecentlyViewedItem[];
}

export const toHeaderSearchPlaceholder = (filter: MediaOrPersonFilterType): string => PLACEHOLDERS[filter];

export const toSearchPageQueryParams = (query: string, filter: MediaOrPersonFilterType): Record<string, string> =>
    filter === 'all' ? { query } : { query, type: filter };

export const toHeaderSearchPanel = (source: HeaderSearchPanelSource): HeaderSearchPanel => {
    if (!source.panelOpen) {
        return HIDDEN_PANEL;
    }

    if (!source.query) {
        const options = source.recentItems.slice(0, MAX_RECENT_OPTIONS).map((item) =>
            item.kind === 'person'
                ? toPersonOption({
                      id: item.id,
                      name: item.name,
                      thumb: item.imagePath,
                      department: item.subtitle,
                      knownFor: '',
                      idPrefix: 'recent',
                  })
                : toTitleOption({
                      id: item.id,
                      kind: item.mediaType,
                      title: item.title,
                      thumb: item.imagePath,
                      year: item.date.slice(0, 4),
                      overview: item.overview,
                      rating: item.rating,
                      idPrefix: 'recent',
                  }),
        );

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
        case 'success': {
            const options = source.searchResultsState.data.map((option) => ({
                ...option,
                titleSegments: toTitleSegments(option.title, source.query),
            }));

            if (options.length === 0) {
                return { kind: 'empty', query: source.query, canWiden: source.searchFilter !== 'all' };
            }

            const [topHit, ...rest] = options;
            const groups =
                source.searchFilter === 'all'
                    ? [
                          {
                              label: 'Titles',
                              showLabel: false,
                              options: rest.filter((option) => option.kind !== 'person').slice(0, MAX_TITLE_OPTIONS),
                          },
                          {
                              label: 'People',
                              showLabel: false,
                              options: rest.filter((option) => option.kind === 'person').slice(0, MAX_PEOPLE_OPTIONS),
                          },
                      ]
                    : [
                          {
                              label: SINGLE_TYPE_GROUP_LABELS[source.searchFilter],
                              showLabel: false,
                              options: rest.slice(0, MAX_SINGLE_TYPE_OPTIONS),
                          },
                      ];

            return {
                kind: 'results',
                label: RESULTS_LABEL,
                topHit,
                groups: groups.filter((group) => group.options.length > 0),
                seeAll: {
                    optionId: HEADER_SEARCH_SEE_ALL_ID,
                    query: source.query,
                    queryParams: toSearchPageQueryParams(source.query, source.searchFilter),
                },
            };
        }
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
            return (
                panel.groups.flatMap((group) => group.options).find((option) => option.optionId === optionId) ?? null
            );
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
        case 'results':
            return pluralize(toNavigableOptionIds(panel).length - 1, 'result');
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
        return [{ key: 'full', text: title, match: false }];
    }

    const end = start + needle.length;

    return (
        [
            { key: 'before', text: title.slice(0, start), match: false },
            { key: 'match', text: title.slice(start, end), match: true },
            { key: 'after', text: title.slice(end), match: false },
        ] satisfies HeaderSearchTitleSegment[]
    ).filter((segment) => segment.text.length > 0);
};

export const toTitleResultOption = (item: MediaListItem): HeaderSearchOption =>
    toTitleOption({
        id: item.id,
        kind: item.mediaType,
        title: item.title,
        thumb: item.thumb,
        year: item.date,
        overview: item.overview,
        rating: item.rating,
    });

export const toPersonResultOption = (person: PersonListItem): HeaderSearchOption =>
    toPersonOption({
        id: person.id,
        name: person.name,
        thumb: person.imagePath,
        department: person.subtitle,
        knownFor: person.knownForLinks.map(({ title }) => title).join(', '),
    });

function toTitleOption(input: {
    readonly id: number;
    readonly kind: MediaType;
    readonly title: string;
    readonly thumb: string | null;
    readonly year: string;
    readonly overview: string;
    readonly rating: number | null;
    readonly idPrefix?: string;
}): HeaderSearchOption {
    const meta = [input.year, MEDIA_TYPE_LABEL[input.kind]].filter(Boolean).join(' · ');

    return {
        optionId: toOptionId(input.kind, input.id, input.idPrefix),
        kind: input.kind,
        title: input.title,
        titleSegments: toTitleSegments(input.title, ''),
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
    readonly idPrefix?: string;
}): HeaderSearchOption {
    const meta = input.department || MEDIA_TYPE_LABEL.person;

    return {
        optionId: toOptionId('person', input.id, input.idPrefix),
        kind: 'person',
        title: input.name,
        titleSegments: toTitleSegments(input.name, ''),
        thumb: input.thumb,
        imageType: 'person',
        meta,
        compactMeta: [meta, input.knownFor].filter(Boolean).join(' · '),
        detail: input.knownFor ? `Known for ${input.knownFor}` : '',
        rating: null,
        routeCommands: ['/name', input.id],
    };
}

function toOptionId(kind: MediaOrPersonType, id: number, prefix = 'result'): string {
    return `${OPTION_ID_PREFIX}-${prefix}-${kind}-${id}`;
}
