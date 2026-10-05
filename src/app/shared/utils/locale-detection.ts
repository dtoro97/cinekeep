import { parseLanguageParam, parseRegionParam } from './route-utils';

export interface DetectedLocale {
    readonly language: string | null;
    readonly region: string | null;
}

const ACCEPT_LANGUAGE_QUALITY_PATTERN = /;\s*q=([0-9.]+)/i;
const NON_COUNTRY_REGION_CODES = new Set(['EU', 'XX']);
const EMPTY_LOCALE: DetectedLocale = { language: null, region: null };

/** The two-letter language of a locale tag: `en-GB`, `pt_BR` and `EN` give `en`, `pt` and `en`. */
export const parseLanguageTag = (tag: string | null | undefined): string | null => parseLocaleTag(tag).language;

export function detectBrowserLocale(): DetectedLocale {
    if (typeof navigator === 'undefined') {
        return EMPTY_LOCALE;
    }

    return detectLocaleFromTags([
        ...(navigator.languages ?? []),
        navigator.language,
        Intl.DateTimeFormat().resolvedOptions().locale,
    ]);
}

export function detectServerLocale(acceptLanguage: string | null): DetectedLocale {
    const tags = (acceptLanguage ?? '')
        .split(',')
        .map((entry, index) => {
            const [tag = ''] = entry.trim().split(';');
            const quality = Number(entry.match(ACCEPT_LANGUAGE_QUALITY_PATTERN)?.[1] ?? '1');

            return {
                tag,
                index,
                quality: Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0,
            };
        })
        .filter((entry) => entry.tag && entry.tag !== '*' && entry.quality > 0)
        .sort((left, right) => right.quality - left.quality || left.index - right.index)
        .map((entry) => entry.tag);

    return detectLocaleFromTags(tags);
}

/** The first tag's language, with the region of the first tag in that language that has one. */
function detectLocaleFromTags(localeTags: readonly (string | null | undefined)[]): DetectedLocale {
    const locales = localeTags.map(parseLocaleTag).filter((locale) => locale.language);
    const language = locales[0]?.language ?? null;
    const region = locales.find((locale) => locale.language === language && locale.region)?.region ?? null;

    return { language, region };
}

function parseLocaleTag(localeTag: string | null | undefined): DetectedLocale {
    const [language, ...subtags] = localeTag?.trim().replace(/_/g, '-').split('-') ?? [];
    const region =
        subtags
            .map((subtag) => parseRegionParam(subtag, ''))
            .find((subtag) => subtag && !NON_COUNTRY_REGION_CODES.has(subtag)) ?? null;

    return { language: parseLanguageParam(language), region };
}
