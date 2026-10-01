/** `pluralize(1, 'title')` → `1 title`, `pluralize(3, 'title')` → `3 titles`. */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;
