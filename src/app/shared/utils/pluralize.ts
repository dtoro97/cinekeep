/** `pluralize(1, 'title')` → `1 title`, `pluralize(12935, 'movie')` → `12,935 movies`. */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
