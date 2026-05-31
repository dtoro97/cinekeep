import {
    detectBrowserLocale,
    type DetectedLocale,
} from './locale-detection';

export type BrowserLocale = DetectedLocale;

export function getBrowserLocale(): BrowserLocale {
    return detectBrowserLocale();
}

export function getBrowserCountry(): string {
    return detectBrowserLocale().region ?? 'US';
}
