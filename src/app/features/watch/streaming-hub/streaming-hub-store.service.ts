import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import {
    WatchProviderOption,
    WatchProviderStoreService,
    sortWatchProviders,
} from '../../../shared';
import {
    StreamingEditorialSection,
    StreamingHubSection,
    StreamingProviderCard,
} from '../models/streaming-browse.models';
import { StreamingQueryService } from '../services/streaming-query.service';
import {
    STREAMING_EDITORIAL_SECTIONS,
    STREAMING_THIS_MONTH_SLUG,
    getStreamingThisMonthCtaLabel,
    getStreamingThisMonthTitle,
} from '../streaming/streaming-browse.config';

const STREAMING_HUB_TITLE = 'Streaming Guide';
const STREAMING_HUB_SUBTITLE =
    'Popular movies and TV series streaming now, grouped by provider, release timing, runtime, and mood.';

interface StreamingHubData {
    readonly providerCards: readonly StreamingProviderCard[];
    readonly featuredSection: StreamingHubSection | null;
    readonly sections: readonly StreamingHubSection[];
}

@Injectable()
export class StreamingHubStoreService extends ComponentStore<Record<string, never>> {
    readonly vm$ = combineLatest({
        providersLoaded: this.watchProviderStore.loaded$,
        movieProviders: this.watchProviderStore.movieProviders$,
        tvProviders: this.watchProviderStore.tvProviders$,
    }).pipe(
        map(({ providersLoaded, movieProviders, tvProviders }) =>
            this.buildHubData(providersLoaded, movieProviders, tvProviders),
        ),
        switchMap((hubData) => {
            const providerCards$ = hubData.providerCards.length
                ? forkJoin(
                      hubData.providerCards.map((card) =>
                          this.streamingQuery.preview$(card.baseQuery).pipe(
                              map((previews) => ({
                                  ...card,
                                  preview:
                                      previews.find(
                                          (preview) => !!preview.backdropPath,
                                      ) ??
                                      previews[0] ??
                                      null,
                              })),
                          ),
                      ),
                  )
                : of([] as StreamingProviderCard[]);
            const sections$ = hubData.sections.length
                ? forkJoin(
                      hubData.sections.map((section) =>
                          this.streamingQuery.preview$(section.baseQuery).pipe(
                              map((previews) => ({
                                  ...section,
                                  previews,
                              })),
                          ),
                      ),
                  )
                : of([] as StreamingHubSection[]);
            const featuredSection$ = hubData.featuredSection
                ? this.streamingQuery
                      .preview$(hubData.featuredSection.baseQuery)
                      .pipe(
                          map((previews) => ({
                              ...hubData.featuredSection!,
                              previews,
                          })),
                      )
                : of(null);

            return forkJoin({
                providerCards: providerCards$,
                featuredSection: featuredSection$,
                sections: sections$,
            }).pipe(startWith(hubData));
        }),
        map((hubData) => ({
            title: STREAMING_HUB_TITLE,
            subtitle: STREAMING_HUB_SUBTITLE,
            providerCards: hubData.providerCards,
            featuredSection: hubData.featuredSection,
            sections: hubData.sections,
        })),
    );

    constructor(
        private readonly watchProviderStore: WatchProviderStoreService,
        private readonly streamingQuery: StreamingQueryService,
    ) {
        super({});
    }

    private buildHubData(
        providersLoaded: boolean,
        movieProviders: readonly WatchProviderOption[],
        tvProviders: readonly WatchProviderOption[],
    ): StreamingHubData {
        return {
            providerCards: this.getTopProviders(movieProviders, tvProviders)
                .slice(0, 3)
                .map((provider) => this.toProviderCard(provider)),
            featuredSection: this.toFeaturedSection(providersLoaded, tvProviders),
            sections: STREAMING_EDITORIAL_SECTIONS.filter(
                (section) => section.slug !== STREAMING_THIS_MONTH_SLUG,
            ).map((section) => this.toHubSection(section)),
        };
    }

    private toHubSection(section: StreamingEditorialSection): StreamingHubSection {
        return {
            slug: section.slug,
            title: section.title,
            description: section.description,
            ctaLabel: section.ctaLabel,
            routerLink: ['/watch', 'streaming', 'list', section.slug],
            baseQuery: section.baseQuery,
            previews: [],
        };
    }

    private toFeaturedSection(
        providersLoaded: boolean,
        tvProviders: readonly WatchProviderOption[],
    ): StreamingHubSection | null {
        if (!providersLoaded) {
            return null;
        }

        const section =
            STREAMING_EDITORIAL_SECTIONS.find(
                (item) => item.slug === STREAMING_THIS_MONTH_SLUG,
            ) ?? null;

        return section
            ? {
                  ...this.toHubSection(section),
                  title: getStreamingThisMonthTitle(),
                  ctaLabel: getStreamingThisMonthCtaLabel(),
                  baseQuery: {
                      ...section.baseQuery,
                      mediaTypes: ['tv'],
                      providerIds: tvProviders.slice(0, 3).map((provider) => provider.id),
                      sortBy: 'popularity',
                  },
              }
            : null;
    }

    private toProviderCard(provider: WatchProviderOption): StreamingProviderCard {
        return {
            slug: `provider-${provider.id}`,
            providerId: provider.id,
            providerName: provider.name,
            providerLogoPath: provider.logoPath,
            routerLink: ['/watch', 'streaming', 'provider', provider.id],
            baseQuery: {
                mediaTypes: ['tv'],
                providerId: provider.id,
                monetization: 'flatrate',
                datePreset: 'current-two-months',
                sortBy: 'popularity',
            },
            preview: null,
        };
    }

    private getTopProviders(
        movieProviders: readonly WatchProviderOption[],
        tvProviders: readonly WatchProviderOption[],
    ): WatchProviderOption[] {
        const providersById = new Map<number, WatchProviderOption>();

        sortWatchProviders([...movieProviders, ...tvProviders])
            .forEach((provider) => {
                if (!providersById.has(provider.id)) {
                    providersById.set(provider.id, provider);
                }
            });

        return Array.from(providersById.values());
    }
}
