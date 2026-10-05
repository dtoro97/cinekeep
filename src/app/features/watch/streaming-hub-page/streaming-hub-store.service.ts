import { Injectable } from '@angular/core';
import { forkJoin, map, of, startWith, switchMap } from 'rxjs';

import {
    CardItem,
    getCurrentMonthName,
    getStreamingThisMonthTitle,
    sortWatchProviders,
    STREAMING_EDITORIAL_SECTIONS,
    STREAMING_THIS_MONTH_SECTION,
    StreamingBaseQuery,
    StreamingQueryService,
    toStreamingThisMonthQuery,
    WatchProviderStoreService,
} from '../../../shared';

const PROVIDER_CARD_COUNT = 3;

@Injectable()
export class StreamingHubStoreService {
    readonly streamingHub$ = this.watchProviderStoreService.catalog$.pipe(
        map(({ loaded, movieProviders, tvProviders }) => {
            const sortedProviders = sortWatchProviders([...movieProviders, ...tvProviders]);
            const featuredSection = loaded
                ? {
                      ...STREAMING_THIS_MONTH_SECTION,
                      routerLink: ['/watch', 'streaming', 'list', STREAMING_THIS_MONTH_SECTION.slug],
                      isFeatured: true,
                      previews: [] as readonly CardItem[],
                      title: getStreamingThisMonthTitle(),
                      ctaLabel: `Browse ${getCurrentMonthName()} arrivals`,
                      baseQuery: toStreamingThisMonthQuery(tvProviders),
                  }
                : null;

            return {
                providerCards: sortedProviders
                    .filter((provider, index) => sortedProviders.findIndex(({ id }) => id === provider.id) === index)
                    .slice(0, PROVIDER_CARD_COUNT)
                    .map((provider) => {
                        const baseQuery: StreamingBaseQuery = {
                            mediaTypes: ['tv'],
                            providerId: provider.id,
                            monetization: 'flatrate',
                            datePreset: 'current-two-months',
                            sortBy: 'popularity',
                        };

                        return {
                            slug: `provider-${provider.id}`,
                            providerName: provider.name,
                            providerLogoPath: provider.logoPath,
                            routerLink: ['/watch', 'streaming', 'provider', provider.id],
                            baseQuery,
                            preview: null as CardItem | null,
                        };
                    }),
                routeSections: [
                    ...(featuredSection ? [featuredSection] : []),
                    ...STREAMING_EDITORIAL_SECTIONS.filter((section) => section !== STREAMING_THIS_MONTH_SECTION).map(
                        (section) => ({
                            ...section,
                            routerLink: ['/watch', 'streaming', 'list', section.slug],
                            isFeatured: false,
                            previews: [] as readonly CardItem[],
                        }),
                    ),
                ],
            };
        }),
        switchMap((hub) =>
            forkJoin({
                providerCards: hub.providerCards.length
                    ? forkJoin(
                          hub.providerCards.map((card) =>
                              this.streamingQueryService.preview$(card.baseQuery).pipe(
                                  map((previews) => ({
                                      ...card,
                                      preview:
                                          previews.find((preview) => !!preview.backdropPath) ?? previews[0] ?? null,
                                  })),
                              ),
                          ),
                      )
                    : of([]),
                routeSections: hub.routeSections.length
                    ? forkJoin(
                          hub.routeSections.map((section) =>
                              this.streamingQueryService
                                  .preview$(section.baseQuery)
                                  .pipe(map((previews) => ({ ...section, previews }))),
                          ),
                      )
                    : of([]),
            }).pipe(startWith(hub)),
        ),
        map((hub) => ({
            ...hub,
            seoBackdropPath:
                hub.routeSections.flatMap((section) => section.previews).find((preview) => !!preview.backdropPath)
                    ?.backdropPath ?? null,
        })),
    );

    constructor(
        private watchProviderStoreService: WatchProviderStoreService,
        private streamingQueryService: StreamingQueryService,
    ) {}
}
