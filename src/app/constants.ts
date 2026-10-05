export const PAGE_SIZE = 20;
// The largest page the CineKeep backend serves.
export const BACKEND_MAX_PAGE_SIZE = 100;
export const SMALL_LIST_COUNT = 5;

export const MEDIUM_LIST_COUNT = 10;
export const DEFAULT_DISCOVER_VOTE_COUNT_GTE = 250;
export const DATE_WINDOW_DISCOVER_VOTE_COUNT_GTE = 50;
export const OPENING_SOON_MOVIE_DAYS_AHEAD = 14;
// TMDb release type 3 is theatrical.
export const THEATRICAL_MOVIE_RELEASE_TYPE = 3;
// TMDb TV genres for news (10763), reality (10764), soap (10766) and talk (10767).
// Daily programming in these genres crowds out series on curated shelves.
export const CURATED_TV_EXCLUDED_GENRE_IDS: readonly number[] = [10763, 10764, 10766, 10767];

