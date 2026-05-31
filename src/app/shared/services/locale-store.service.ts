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
    type DetectedLocale,
} from '../utils/locale-detection';
import { parseLanguageParam, parseRegionParam } from '../utils/route-utils';

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
        const language = normalizeLanguage(iso639);

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

    private hydrateBrowserLocale(): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        const current = this.get();
        const cookieLanguage = this.browserStorage.getCookie(
            STORAGE_KEY_LANGUAGE,
        );
        const cookieRegion = this.browserStorage.getCookie(STORAGE_KEY_REGION);
        const storedLanguage = this.browserStorage.getItem(
            STORAGE_KEY_LANGUAGE,
        );
        const storedRegion = this.browserStorage.getItem(STORAGE_KEY_REGION);
        const shouldPersistLocale =
            cookieLanguage !== current.language ||
            cookieRegion !== current.region ||
            storedLanguage !== current.language ||
            storedRegion !== current.region;

        if (shouldPersistLocale) {
            this.persistLocale(current.language, current.region);
        }
    }

    private persistLocale(language: string, region: string): void {
        this.browserStorage.setItem(STORAGE_KEY_LANGUAGE, language);
        this.browserStorage.setCookie(STORAGE_KEY_LANGUAGE, language);
        this.browserStorage.setItem(STORAGE_KEY_REGION, region);
        this.browserStorage.setCookie(STORAGE_KEY_REGION, region);
    }

    private reloadBrowserPage(): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        window.location.reload();
    }
}

function normalizeLanguage(value: string | null | undefined): string {
    const language = value?.replace(/_/g, '-').split('-')[0];

    return parseLanguageParam(language) ?? DEFAULT_LANGUAGE;
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
        language: normalizeLanguageOrNull(
            browserStorage.getCookie(STORAGE_KEY_LANGUAGE) ??
                browserStorage.getItem(STORAGE_KEY_LANGUAGE),
        ),
        region: normalizeRegionOrNull(
            browserStorage.getCookie(STORAGE_KEY_REGION) ??
                browserStorage.getItem(STORAGE_KEY_REGION),
        ),
    };
}

function normalizeLanguageOrNull(value: string | null): string | null {
    const language = value?.replace(/_/g, '-').split('-')[0];

    return parseLanguageParam(language);
}

function normalizeRegionOrNull(value: string | null): string | null {
    const region = parseRegionParam(value, '');

    return region || null;
}
