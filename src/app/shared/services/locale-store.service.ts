import {
    afterNextRender,
    Injectable,
    makeStateKey,
    TransferState,
} from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import { BrowserStorageService } from './browser-storage.service';
import {
    detectBrowserLocale,
    detectServerLocale,
    parseLanguageTag,
    type DetectedLocale,
} from '../utils/locale-detection';
import { parseRegionParam } from '../utils/route-utils';

const STORAGE_KEY_LANGUAGE = 'tmdb_language';
const STORAGE_KEY_REGION = 'tmdb_region';
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_REGION = 'US';
const ACCEPT_LANGUAGE_HEADER = 'accept-language';
const LOCALE_TRANSFER_KEY = makeStateKey<LocaleState>('tmdb-locale');

interface LocaleState {
    readonly language: string;
    readonly region: string;
}

@Injectable({ providedIn: 'root' })
export class LocaleStoreService extends ComponentStore<LocaleState> {
    readonly language$ = this.select((state) => state.language);
    readonly region$ = this.select((state) => state.region);
    readonly locale$ = this.select((state) => ({
        language: state.language,
        region: state.region,
    }));

    constructor(
        private readonly browserStorage: BrowserStorageService,
        private readonly transferState: TransferState,
    ) {
        const initialLocale = getInitialLocale(browserStorage, transferState);

        super(initialLocale);

        if (!browserStorage.isBrowserEnvironment()) {
            transferState.set(LOCALE_TRANSFER_KEY, initialLocale);
        }

        afterNextRender(() => {
            this.hydrateBrowserLocale();
        });
    }

    language(): string {
        return this.get().language;
    }

    region(): string {
        return this.get().region;
    }

    setLanguage(iso639: string): void {
        const language = parseLanguageTag(iso639) ?? DEFAULT_LANGUAGE;

        this.patchState({ language });
        this.persistLocale(language, this.get().region);
        this.reloadBrowserPage();
    }

    setRegion(iso3166: string): void {
        const region = parseRegionParam(iso3166, DEFAULT_REGION);

        this.patchState({ region });
        this.persistLocale(this.get().language, region);
        this.reloadBrowserPage();
    }

    /** Rewrites the cookies on every visit, so their one-year expiry keeps rolling forward. */
    private hydrateBrowserLocale(): void {
        const current = this.get();
        this.persistLocale(current.language, current.region);
    }

    /** Cookies alone: the server reads them to render in the visitor's locale. */
    private persistLocale(language: string, region: string): void {
        this.browserStorage.setCookie(STORAGE_KEY_LANGUAGE, language);
        this.browserStorage.setCookie(STORAGE_KEY_REGION, region);
    }

    private reloadBrowserPage(): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        window.location.reload();
    }
}

function getInitialLocale(
    browserStorage: BrowserStorageService,
    transferState: TransferState,
): LocaleState {
    const persistedLocale = getPersistedLocale(browserStorage);
    const detectedLocale = browserStorage.isBrowserEnvironment()
        ? transferState.get(LOCALE_TRANSFER_KEY, null) ?? detectBrowserLocale()
        : detectServerLocale(
              browserStorage.getRequestHeader(ACCEPT_LANGUAGE_HEADER),
          );

    return {
        language:
            persistedLocale.language ??
            detectedLocale.language ??
            DEFAULT_LANGUAGE,
        region:
            persistedLocale.region ?? detectedLocale.region ?? DEFAULT_REGION,
    };
}

function getPersistedLocale(
    browserStorage: BrowserStorageService,
): DetectedLocale {
    return {
        language: parseLanguageTag(browserStorage.getCookie(STORAGE_KEY_LANGUAGE)),
        region: normalizeRegionOrNull(browserStorage.getCookie(STORAGE_KEY_REGION)),
    };
}

function normalizeRegionOrNull(value: string | null): string | null {
    const region = parseRegionParam(value, '');

    return region || null;
}
