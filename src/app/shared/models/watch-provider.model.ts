export interface WatchProviderOption {
    readonly id: number;
    readonly name: string;
    readonly logoPath: string | null;
    readonly displayPriority: number;
}

/** How many of a region's providers count as its main ones, e.g. for "streaming this month". */
export const TOP_PROVIDER_COUNT = 3;
