export interface TitleSegment {
    readonly key: 'full' | 'before' | 'match' | 'after';
    readonly text: string;
    readonly match: boolean;
}

/** Splits a title around the first case-insensitive match of the query, for highlighting. */
export const toTitleSegments = (title: string, query: string): TitleSegment[] => {
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
        ] satisfies TitleSegment[]
    ).filter((segment) => segment.text.length > 0);
};
