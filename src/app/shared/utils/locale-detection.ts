export interface DetectedLocale {
    readonly language: string | null;
    readonly region: string | null;
}

const LANGUAGE_PATTERN = /^[a-z]{2}$/;
const REGION_PATTERN = /^[A-Z]{2}$/;
const ACCEPT_LANGUAGE_QUALITY_PATTERN = /;\s*q=([0-9.]+)/i;
const NON_COUNTRY_REGION_CODES = new Set(['EU', 'XX']);

export function detectBrowserLocale(): DetectedLocale {
    if (typeof navigator === 'undefined') {
        return EMPTY_LOCALE;
    }

    const dateTimeLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    const localeTags = [
        ...(navigator.languages ?? []),
        navigator.language,
        dateTimeLocale,
    ];

    return detectLocaleFromTags(localeTags);
}

export function detectServerLocale(
    acceptLanguage: string | null,
): DetectedLocale {
    return detectLocaleFromTags(parseAcceptLanguage(acceptLanguage));
}

export function detectLocaleFromTags(
    localeTags: readonly (string | null | undefined)[],
): DetectedLocale {
    let language: string | null = null;
    let region: string | null = null;

    for (const localeTag of localeTags) {
        const locale = parseLocaleTag(localeTag);

        if (!locale.language) {
            continue;
        }

        language ??= locale.language;

        if (locale.language === language && locale.region) {
            region = locale.region;
            break;
        }
    }

    return { language, region };
}

function parseAcceptLanguage(header: string | null): string[] {
    if (!header) {
        return [];
    }

    return header
        .split(',')
        .map((entry, index) => {
            const [tag = ''] = entry.trim().split(';');
            const quality = Number(
                entry.match(ACCEPT_LANGUAGE_QUALITY_PATTERN)?.[1] ?? '1',
            );

            return {
                tag,
                index,
                quality:
                    Number.isFinite(quality) && quality >= 0 && quality <= 1
                        ? quality
                        : 0,
            };
        })
        .filter((entry) => entry.tag && entry.tag !== '*' && entry.quality > 0)
        .sort(
            (left, right) =>
                right.quality - left.quality || left.index - right.index,
        )
        .map((entry) => entry.tag);
}

function parseLocaleTag(localeTag: string | null | undefined): DetectedLocale {
    const parts = localeTag?.trim().replace(/_/g, '-').split('-') ?? [];
    const language = normalizeLanguage(parts[0]);
    const region = parts
        .slice(1)
        .map((part) => normalizeRegion(part))
        .find((part): part is string => part !== null) ?? null;

    return { language, region };
}

function normalizeLanguage(language: string | null | undefined): string | null {
    const normalized = language?.trim().toLowerCase();

    return normalized && LANGUAGE_PATTERN.test(normalized) ? normalized : null;
}

function normalizeRegion(region: string | null | undefined): string | null {
    const normalized = region?.trim().toUpperCase();

    return normalized &&
        REGION_PATTERN.test(normalized) &&
        !NON_COUNTRY_REGION_CODES.has(normalized)
        ? normalized
        : null;
}

const EMPTY_LOCALE: DetectedLocale = {
    language: null,
    region: null,
};
