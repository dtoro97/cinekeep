const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

/** Builds a TMDb image URL for `size`; absolute URLs (some TMDb paths are full links) pass through. */
export const buildTmdbImageUrl = (value: string | null | undefined, size = 'w1280'): string | null => {
    if (!value) {
        return null;
    }

    if (value.startsWith('/http://') || value.startsWith('/https://')) {
        return value.slice(1);
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }

    const normalizedValue = value.startsWith('/') ? value : `/${value}`;
    return `${TMDB_IMAGE_BASE_URL}${size}${normalizedValue}`;
};
