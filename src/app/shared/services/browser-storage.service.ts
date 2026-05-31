import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
    Inject,
    Injectable,
    Optional,
    PLATFORM_ID,
    REQUEST,
} from '@angular/core';

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
        if (this.isBrowser) {
            return null;
        }

        return this.request?.headers.get(name) ?? null;
    }

    getItem(key: string): string | null {
        if (typeof localStorage === 'undefined') {
            return null;
        }

        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    getItemOrDefault(key: string, fallback: string): string {
        return this.getItem(key) ?? fallback;
    }

    setItem(key: string, value: string): void {
        if (typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.setItem(key, value);
        } catch {
            return;
        }
    }

    writeItem(key: string, value: string | null): void {
        if (value === null) {
            this.removeItem(key);
            return;
        }

        this.setItem(key, value);
    }

    removeItem(key: string): void {
        if (typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.removeItem(key);
        } catch {
            return;
        }
    }

    getCookie(key: string): string | null {
        return this.readCookie(key, this.cookieSource());
    }

    getCookieOrDefault(key: string, fallback: string): string {
        return this.getCookie(key) ?? fallback;
    }

    setCookie(key: string, value: string): void {
        if (!this.isBrowser || !this.document.defaultView) {
            return;
        }

        const secure = this.document.location?.protocol === 'https:' ? '; Secure' : '';
        this.document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    }

    writeCookie(key: string, value: string | null): void {
        if (value === null) {
            this.removeCookie(key);
            return;
        }

        this.setCookie(key, value);
    }

    removeCookie(key: string): void {
        if (!this.isBrowser || !this.document.defaultView) {
            return;
        }

        const secure = this.document.location?.protocol === 'https:' ? '; Secure' : '';
        this.document.cookie = `${encodeURIComponent(key)}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    }

    private cookieSource(): string {
        if (this.isBrowser) {
            return this.document.cookie ?? '';
        }

        return this.request?.headers.get('cookie') ?? '';
    }

    private readCookie(key: string, source: string): string | null {
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
}
