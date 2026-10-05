/** A TMDb vote average as a displayable rating; `null` means unrated (TMDb reports unrated as 0). */
export function toRating(voteAverage: number | null | undefined): number | null {
    return voteAverage && voteAverage > 0 ? voteAverage : null;
}

export function normalizeRatingValue(value: number): number {
    const normalized = Math.round(Math.min(10, Math.max(0.5, value)) * 2) / 2;
    return Number(normalized.toFixed(1));
}
