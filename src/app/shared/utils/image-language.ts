import { parseLanguageTag } from './locale-detection';

const ENGLISH_LANGUAGE = 'en';
const NEUTRAL_IMAGE_LANGUAGE = 'null';

export function buildImageLanguageFallback(): string {
    return [ENGLISH_LANGUAGE, NEUTRAL_IMAGE_LANGUAGE].join(',');
}

export function isPreferredImageLanguage(
    imageLanguage: string | null | undefined,
    preferredLanguage: string | null | undefined,
): boolean {
    const preferred = parseLanguageTag(preferredLanguage);

    return (
        imageLanguage === null ||
        imageLanguage === ENGLISH_LANGUAGE ||
        (!!preferred && imageLanguage === preferred)
    );
}
