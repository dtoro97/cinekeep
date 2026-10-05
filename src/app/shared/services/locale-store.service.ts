import { afterNextRender, Injectable, makeStateKey, TransferState } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import { BrowserStorageService } from './browser-storage.service';
import { detectBrowserLocale, detectServerLocale, parseLanguageTag } from '../utils/locale-detection';
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
    readonly region$ = this.select((state) => state.region);
    readonly locale$ = this.select((state) => ({
        language: state.language,
        region: state.region,
    }));

    constructor(
        private readonly browserStorage: BrowserStorageService,
        transferState: TransferState,
    ) {
        const isBrowser = browserStorage.isBrowserEnvironment();
        // The browser reuses what the server detected, so hydration renders the same locale.
        const detectedLocale = isBrowser
            ? (transferState.get(LOCALE_TRANSFER_KEY, null) ?? detectBrowserLocale())
            : detectServerLocale(browserStorage.getRequestHeader(ACCEPT_LANGUAGE_HEADER));
        const initialLocale: LocaleState = {
            language:
                parseLanguageTag(browserStorage.getCookie(STORAGE_KEY_LANGUAGE)) ??
                detectedLocale.language ??
                DEFAULT_LANGUAGE,
            region:
                parseRegionParam(browserStorage.getCookie(STORAGE_KEY_REGION), '') ||
                detectedLocale.region ||
                DEFAULT_REGION,
        };

        super(initialLocale);

        if (!isBrowser) {
            transferState.set(LOCALE_TRANSFER_KEY, initialLocale);
        }

        // Rewrites the cookies on every visit, so their one-year expiry keeps rolling forward.
        afterNextRender(() => this.persistLocale(this.get().language, this.get().region));
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

