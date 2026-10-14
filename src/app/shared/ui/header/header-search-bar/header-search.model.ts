import type { MediaOrPersonType, RouteCommands } from '../../../types';
import type { ImageType } from '../../image/image.component';
import type { TitleSegment } from '../../../utils/title-segments';

export interface HeaderSearchOption {
    readonly optionId: string;
    readonly kind: MediaOrPersonType;
    readonly title: string;
    readonly titleSegments: readonly TitleSegment[];
    readonly thumb: string | null;
    readonly imageType: ImageType;
    /** "2021 · Movie" for titles, the department for people. */
    readonly meta: string;
    /** Single-line summary for compact rows; people also get their known-for titles. */
    readonly compactMeta: string;
    /** Overview for titles, "Known for …" for people. Only the top hit shows it. */
    readonly detail: string;
    readonly rating: number | null;
    readonly routeCommands: RouteCommands;
}

export interface HeaderSearchResults {
    readonly options: readonly HeaderSearchOption[];
    /** Every match TMDb has for the query, not just the first page shown in the panel. */
    readonly totalResults: number;
}

export interface HeaderSearchGroup {
    readonly label: string;
    readonly options: readonly HeaderSearchOption[];
}

export interface HeaderSearchSeeAll {
    readonly optionId: string;
    readonly query: string;
    /** "See all 585 results", or "See all results" when TMDb gave no total. */
    readonly label: string;
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
    | { readonly kind: 'option'; readonly routeCommands: RouteCommands }
    | { readonly kind: 'search'; readonly queryParams: Readonly<Record<string, string>> }
    | { readonly kind: 'none' };

export type HeaderSearchDismissStep = 'panel' | 'query' | 'sheet' | 'none';
