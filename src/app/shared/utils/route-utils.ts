import { isDefined } from './is-defined';

const INTEGER_PARAM_PATTERN = /^-?\d+$/;
const FLOAT_PARAM_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;

export const parseStringParam = (value: string | null | undefined): string | null => value?.trim() || null;

export const parsePositiveNumberParam = (value: string | null | undefined): number | null => {
    const parsed = parseNumberParam(value, FLOAT_PARAM_PATTERN);
    return parsed !== null && parsed > 0 ? parsed : null;
};

export const parsePositiveIntegerParam = (value: string | null | undefined): number | null => {
    const parsed = parseNumberParam(value, INTEGER_PARAM_PATTERN);
    return parsed !== null && parsed > 0 ? parsed : null;
};

/** `'3,1,3'` → `[3, 1]`; entries that are not positive integers are dropped. */
export const parsePositiveIntegerListParam = (value: string | null | undefined): number[] => [
    ...new Set((value ?? '').split(',').map((part) => parsePositiveIntegerParam(part)).filter(isDefined)),
];

export const parseBoundedIntegerParam = (value: string | null | undefined, min: number, max: number): number | null => {
    const parsed = parseNumberParam(value, INTEGER_PARAM_PATTERN);
    return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
};

export const parseEnumParam = <T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T =>
    typeof value === 'string' && allowedValues.includes(value as T) ? (value as T) : fallback;

export const parseRegionParam = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') {
        return fallback;
    }

    const region = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(region) ? region : fallback;
};

export const parseLanguageParam = (value: string | null | undefined): string | null => {
    const language = value?.trim().toLowerCase();
    return language && /^[a-z]{2}$/.test(language) ? language : null;
};

export const serializeNumberListParam = (
    values: readonly number[] | null | undefined,
    separator = ',',
): string | null => (values?.length ? values.join(separator) : null);

function parseNumberParam(value: string | null | undefined, pattern: RegExp): number | null {
    const normalized = parseStringParam(value);

    if (!normalized || !pattern.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
