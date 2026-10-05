import { Injectable, afterNextRender } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import { RecentlyViewedItem } from '../models';
import { BrowserStorageService } from './browser-storage.service';

interface RecentlyViewedState {
    readonly items: readonly RecentlyViewedItem[];
}

const STORAGE_KEY_RECENTLY_VIEWED = 'tmdb_recently_viewed';
const MAX_RECENTLY_VIEWED_ITEMS = 12;

/** The visitor's last viewed titles and people, kept in local storage, which stays the source of truth. */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedStoreService extends ComponentStore<RecentlyViewedState> {
    readonly recentlyViewed$ = this.select(({ items }) => ({ items, hasItems: items.length > 0 }));
    readonly items$ = this.select((state) => state.items);

    constructor(private readonly browserStorage: BrowserStorageService) {
        super({ items: [] });

        // Read after the first render, so the server render and hydration both start from the empty list.
        afterNextRender(() => this.patchState({ items: readStoredItems(browserStorage) }));
    }

    addItem(item: RecentlyViewedItem): void {
        if (!this.browserStorage.isBrowserEnvironment()) {
            return;
        }

        const items = toUniqueRecentItems([item, ...readStoredItems(this.browserStorage)]);

        this.browserStorage.setItem(STORAGE_KEY_RECENTLY_VIEWED, JSON.stringify(items));
        this.patchState({ items });
    }

    clearAll(): void {
        this.browserStorage.removeItem(STORAGE_KEY_RECENTLY_VIEWED);
        this.patchState({ items: [] });
    }
}

function readStoredItems(browserStorage: BrowserStorageService): RecentlyViewedItem[] {
    try {
        const parsed: unknown = JSON.parse(browserStorage.getItem(STORAGE_KEY_RECENTLY_VIEWED) ?? '[]');

        return Array.isArray(parsed)
            ? toUniqueRecentItems(
                  parsed.filter(
                      (item): item is RecentlyViewedItem =>
                          !!item?.id &&
                          ((item.kind === 'media' && (item.mediaType === 'movie' || item.mediaType === 'tv')) ||
                              (item.kind === 'person' && typeof item.name === 'string')),
                  ),
              )
            : [];
    } catch {
        // Unreadable storage from an older or tampered version starts the list over.
        return [];
    }
}

function toUniqueRecentItems(items: readonly RecentlyViewedItem[]): RecentlyViewedItem[] {
    return items
        .filter((item, index) => items.findIndex((other) => other.kind === item.kind && other.id === item.id) === index)
        .slice(0, MAX_RECENTLY_VIEWED_ITEMS);
}
