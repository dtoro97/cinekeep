import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, forkJoin, map, of, shareReplay, tap } from 'rxjs';

import { WatchProviderRestControllerService } from '../../api';
import type { MediaType } from '../types';
import { LocaleStoreService } from './locale-store.service';

export interface WatchProviderOption {
    readonly id: number;
    readonly name: string;
    readonly logoPath: string | null;
    readonly displayPriority: number;
}

const FEATURED_PROVIDER_IDS = [8, 337, 1899, 119];

export const sortWatchProviders = <T extends { readonly id: number; readonly displayPriority: number }>(
    providers: readonly T[],
): T[] =>
    [...providers].sort(
        (left, right) =>
            getProviderPriority(left.id) - getProviderPriority(right.id) ||
            left.displayPriority - right.displayPriority,
    );

const getProviderPriority = (providerId: number): number => {
    const index = FEATURED_PROVIDER_IDS.indexOf(providerId);
    return index === -1 ? FEATURED_PROVIDER_IDS.length : index;
};

interface WatchProviderStoreState {
    movieProviders: WatchProviderOption[];
    tvProviders: WatchProviderOption[];
    loaded: boolean;
}

@Injectable({ providedIn: 'root' })
export class WatchProviderStoreService extends ComponentStore<WatchProviderStoreState> {
    readonly movieProviders$ = this.select((state) => state.movieProviders);
    readonly tvProviders$ = this.select((state) => state.tvProviders);
    readonly loaded$ = this.select((state) => state.loaded);
    /**
     * Load flag and both lists in one emission. Combining the separate selectors can briefly
     * see `loaded` before the lists, which made provider pages look like unknown providers.
     */
    readonly catalog$ = this.select(({ loaded, movieProviders, tvProviders }) => ({
        loaded,
        movieProviders,
        tvProviders,
    }));
    private loadingRegion: string | null = null;
    private loadedRegion: string | null = null;
    private readonly catalogRequests = new Map<string, Observable<WatchProviderOption[]>>();

    readonly topMovieProviders$ = this.select(this.movieProviders$, (providers) => providers.slice(0, 3));

    readonly topTvProviders$ = this.select(this.tvProviders$, (providers) => providers.slice(0, 3));

    constructor(
        private readonly watchProviderService: WatchProviderRestControllerService,
        private readonly localeStore: LocaleStoreService,
    ) {
        super({
            movieProviders: [],
            tvProviders: [],
            loaded: false,
        });
    }

    load(): void {
        const region = this.localeStore.region();

        if (this.loadingRegion === region || this.loadedRegion === region) {
            return;
        }

        this.loadingRegion = region;

        forkJoin({
            movieProviders: this.providers$('movie', region),
            tvProviders: this.providers$('tv', region),
        })
            .pipe(
                tap((result) => {
                    this.loadedRegion = region;
                    this.loadingRegion = null;
                    this.patchState({
                        ...result,
                        loaded: true,
                    });
                }),
            )
            .subscribe();
    }
    /** The providers for one media type and region, fetched once per session; failures yield none. */
    providers$(mediaType: MediaType, region: string): Observable<WatchProviderOption[]> {
        const key = `${mediaType}:${region}`;
        const cached$ = this.catalogRequests.get(key);

        if (cached$) {
            return cached$;
        }

        const catalog$ =
            mediaType === 'movie'
                ? this.watchProviderService.watchProvidersMovieList({ watchRegion: region })
                : this.watchProviderService.watchProviderTvList({ watchRegion: region });

        const providers$ = catalog$.pipe(
            map((catalog) => this.mapProviders(catalog.results ?? [])),
            catchError(() => {
                this.catalogRequests.delete(key);
                return of([]);
            }),
            shareReplay(1),
        );

        this.catalogRequests.set(key, providers$);
        return providers$;
    }

    private mapProviders(
        items: readonly {
            provider_id?: number;
            provider_name?: string;
            logo_path?: string;
            display_priority?: number;
        }[],
    ): WatchProviderOption[] {
        const providers = items
            .filter(
                (p): p is typeof p & { provider_id: number; provider_name: string } =>
                    typeof p.provider_id === 'number' && typeof p.provider_name === 'string',
            )
            .map((p) => ({
                id: p.provider_id,
                name: p.provider_name,
                logoPath: p.logo_path ?? null,
                displayPriority: p.display_priority ?? 999,
            }));

        return sortWatchProviders(providers);
    }
}
