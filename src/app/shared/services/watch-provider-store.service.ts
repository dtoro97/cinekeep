import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import { Observable, catchError, forkJoin, map, of, shareReplay, tap } from 'rxjs';

import { WatchProviderCatalogItem, WatchProviderRestControllerService } from '../../api';
import type { WatchProviderOption } from '../models/watch-provider.model';
import type { MediaType, RemoteData } from '../types';
import { remoteSuccess } from '../utils/remote-data';
import { LocaleStoreService } from './locale-store.service';

interface RegionWatchProviders {
    readonly movieProviders: readonly WatchProviderOption[];
    readonly tvProviders: readonly WatchProviderOption[];
}

interface WatchProviderStoreState {
    readonly regionProviders: RemoteData<RegionWatchProviders>;
}

const FEATURED_PROVIDER_IDS = [8, 337, 1899, 119];

@Injectable({ providedIn: 'root' })
export class WatchProviderStoreService extends ComponentStore<WatchProviderStoreState> {
    /** The providers of the locale's region. Changing the region reloads the page, so they load once. */
    readonly regionProviders$ = this.select((state) => state.regionProviders);

    private readonly providerRequests = new Map<string, Observable<WatchProviderOption[]>>();

    constructor(
        private readonly watchProviderRestControllerService: WatchProviderRestControllerService,
        private readonly localeStoreService: LocaleStoreService,
    ) {
        super({ regionProviders: { state: 'notAsked' } });
    }

    load$(): Observable<unknown> {
        const region = this.localeStoreService.region();

        this.patchState({ regionProviders: { state: 'loading' } });

        return forkJoin({
            movieProviders: this.providers$('movie', region),
            tvProviders: this.providers$('tv', region),
        }).pipe(tap((regionProviders) => this.patchState({ regionProviders: remoteSuccess(regionProviders) })));
    }

    /** The providers for one media type and region, fetched once per session. */
    providers$(mediaType: MediaType, region: string): Observable<WatchProviderOption[]> {
        const key = `${mediaType}:${region}`;
        const cached$ = this.providerRequests.get(key);

        if (cached$) {
            return cached$;
        }

        const catalog$ =
            mediaType === 'movie'
                ? this.watchProviderRestControllerService.watchProvidersMovieList({ watchRegion: region })
                : this.watchProviderRestControllerService.watchProviderTvList({ watchRegion: region });

        const providers$ = catalog$.pipe(
            map((catalog) =>
                sortWatchProviders(
                    (catalog.results ?? [])
                        .filter(
                            (item): item is WatchProviderCatalogItem & { provider_id: number; provider_name: string } =>
                                !!item.provider_id && !!item.provider_name,
                        )
                        .map((item) => ({
                            id: item.provider_id,
                            name: item.provider_name,
                            logoPath: item.logo_path ?? null,
                            displayPriority: item.display_priority ?? 999,
                        })),
                ),
            ),
            // Providers only fill filters and shortcuts, which stay empty without them; the failure is
            // dropped from the cache so a later call retries.
            catchError(() => {
                this.providerRequests.delete(key);
                return of([]);
            }),
            shareReplay(1),
        );

        this.providerRequests.set(key, providers$);
        return providers$;
    }
}

/** Featured providers first, in their listed order, then TMDb's display priority. */
export const sortWatchProviders = <T extends { readonly id: number; readonly displayPriority: number }>(
    providers: readonly T[],
): T[] => {
    const toRank = (id: number) => {
        const index = FEATURED_PROVIDER_IDS.indexOf(id);
        return index === -1 ? FEATURED_PROVIDER_IDS.length : index;
    };

    return [...providers].sort(
        (left, right) => toRank(left.id) - toRank(right.id) || left.displayPriority - right.displayPriority,
    );
};
