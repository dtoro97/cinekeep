import { afterNextRender, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { RecentlyViewedItem } from '../models';
import { BrowserStorageService } from './browser-storage.service';

const STORAGE_KEY_RECENTLY_VIEWED = 'tmdb_recently_viewed';
const MAX_RECENTLY_VIEWED_ITEMS = 12;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedStoreService {
    private readonly itemsSubject = new BehaviorSubject<RecentlyViewedItem[]>(
        [],
    );
    private hydrated = false;

    readonly items$ = this.itemsSubject.asObservable();

    constructor(private readonly browserStorage: BrowserStorageService) {
        afterNextRender(() => {
            this.hydrateFromStorage();
        });
    }

    addItem(item: RecentlyViewedItem): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        this.hydrateFromStorage();

        const nextItems = this.normalizeItems([
            item,
            ...this.itemsSubject.getValue(),
        ]);
        this.itemsSubject.next(nextItems);
        this.browserStorage.setItem(
            STORAGE_KEY_RECENTLY_VIEWED,
            JSON.stringify(nextItems),
        );
    }

    clearAll(): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        this.hydrated = true;
        this.itemsSubject.next([]);
        this.browserStorage.removeItem(STORAGE_KEY_RECENTLY_VIEWED);
    }

    private hydrateFromStorage(): void {
        if (this.hydrated || !this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        this.hydrated = true;
        this.itemsSubject.next(this.readInitialItems());
    }

    private readInitialItems(): RecentlyViewedItem[] {
        const rawValue = this.browserStorage.getItem(
            STORAGE_KEY_RECENTLY_VIEWED,
        );

        if (!rawValue) {
            return [];
        }

        try {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return this.normalizeItems(
                parsed.filter((item) => this.isValidItem(item)),
            );
        } catch {
            return [];
        }
    }

    private normalizeItems(
        items: readonly RecentlyViewedItem[],
    ): RecentlyViewedItem[] {
        const seen = new Set<string>();
        const uniqueItems = items.filter((item) => {
            const key = `${item.kind}:${item.id}`;
            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });

        return uniqueItems.slice(0, MAX_RECENTLY_VIEWED_ITEMS);
    }

    private isValidItem(value: unknown) {
        if (value === null || typeof value !== 'object') {
            return false;
        }

        const item = value as Record<string, unknown>;

        if (!item['id']) {
            return false;
        }

        if (item['kind'] === 'media') {
            return item['mediaType'] === 'movie' || item['mediaType'] === 'tv';
        }

        if (item['kind'] === 'person') {
            return typeof item['name'] === 'string';
        }

        return false;
    }
}
