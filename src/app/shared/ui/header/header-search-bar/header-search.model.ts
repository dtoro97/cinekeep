import type { MediaOrPersonFilterType } from '../../../types';

export type SearchFilterValue = MediaOrPersonFilterType;

export type HeaderSearchOptionKind = 'movie' | 'tv' | 'person';

export interface HeaderSearchTitleSegment {
    readonly text: string;
    readonly match: boolean;
}

export interface HeaderSearchOption {
    readonly optionId: string;
    readonly kind: HeaderSearchOptionKind;
    readonly title: string;
    readonly titleSegments: readonly HeaderSearchTitleSegment[];
    readonly thumb: string | null;
    readonly imageType: 'media' | 'person';
    /** "2021 · Movie" for titles, the department for people. */
    readonly meta: string;
    /** Single-line summary for compact rows; people also get their known-for titles. */
    readonly compactMeta: string;
    /** Overview for titles, "Known for …" for people. Only the top hit shows it. */
    readonly detail: string;
    readonly rating: number | null;
    readonly routeCommands: readonly (string | number)[];
}

export interface HeaderSearchGroup {
    readonly label: string;
    /** Result groups are separated by a rule; only the recent list needs a visible label. */
    readonly showLabel: boolean;
    readonly options: readonly HeaderSearchOption[];
}

export interface HeaderSearchSeeAll {
    readonly optionId: string;
    readonly query: string;
    readonly queryParams: Readonly<Record<string, string>>;
}

export type HeaderSearchPanel =
    | { readonly kind: 'hidden' }
    | {
          readonly kind: 'recent';
          readonly label: string;
          readonly groups: readonly HeaderSearchGroup[];
      }
    | { readonly kind: 'loading' }
    | {
          readonly kind: 'results';
          readonly label: string;
          readonly topHit: HeaderSearchOption;
          readonly groups: readonly HeaderSearchGroup[];
          readonly seeAll: HeaderSearchSeeAll;
      }
    | {
          readonly kind: 'empty';
          readonly query: string;
          readonly canWiden: boolean;
      }
    | { readonly kind: 'error' };

export type HeaderSearchSubmitAction =
    | { readonly kind: 'option'; readonly routeCommands: readonly (string | number)[] }
    | { readonly kind: 'search'; readonly queryParams: Readonly<Record<string, string>> }
    | { readonly kind: 'none' };

export type HeaderSearchDismissStep = 'panel' | 'query' | 'sheet' | 'none';

export interface HeaderSearchBarViewModel {
    readonly searchFilter: SearchFilterValue;
    readonly searchOpen: boolean;
    readonly placeholder: string;
    readonly hasQuery: boolean;
    readonly panel: HeaderSearchPanel;
    readonly listboxVisible: boolean;
    readonly activeOptionId: string | null;
    readonly statusMessage: string;
}
