import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, Optional, PLATFORM_ID, REQUEST } from '@angular/core';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

@Injectable({ providedIn: 'root' })
export class BrowserStorageService {
    private readonly isBrowser: boolean;

    constructor(
        @Inject(DOCUMENT) private readonly document: Document,
        @Inject(PLATFORM_ID) platformId: object,
        @Optional() @Inject(REQUEST) private readonly request: Request | null,
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    isBrowserEnvironment(): boolean {
        return this.isBrowser;
    }

    getRequestHeader(name: string): string | null {
        return this.isBrowser ? null : (this.request?.headers.get(name) ?? null);
    }

    // Storage access throws when the browser blocks it (privacy modes, disabled cookies); the app then runs without it.
    getItem(key: string): string | null {
        try {
            return this.isBrowser ? localStorage.getItem(key) : null;
        } catch {
            return null;
        }
    }

    setItem(key: string, value: string): void {
        try {
            if (this.isBrowser) {
                localStorage.setItem(key, value);
            }
        } catch {
            return;
        }
    }

    removeItem(key: string): void {
        try {
            if (this.isBrowser) {
                localStorage.removeItem(key);
            }
        } catch {
            return;
        }
    }

    getCookie(key: string): string | null {
        const source = this.isBrowser ? this.document.cookie : (this.request?.headers.get('cookie') ?? '');
        const encodedKey = encodeURIComponent(key);
        const pair = source
            .split(';')
            .map((cookie) => cookie.trim())
            .find((cookie) => cookie.startsWith(`${encodedKey}=`));

        if (!pair) {
            return null;
        }

        const value = pair.slice(encodedKey.length + 1);

        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    setCookie(key: string, value: string): void {
        if (!this.isBrowser) {
            return;
        }

        const secure = this.document.location.protocol === 'https:' ? '; Secure' : '';
        this.document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    }
}
