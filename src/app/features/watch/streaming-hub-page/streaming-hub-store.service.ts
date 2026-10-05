import { Injectable } from '@angular/core';
import { forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { CardItem, getCurrentMonthName, sortWatchProviders, WatchProviderStoreService } from '../../../shared';
import {
    getStreamingThisMonthTitle,
    STREAMING_EDITORIAL_SECTIONS,
    STREAMING_THIS_MONTH_SLUG,
    StreamingBaseQuery,
    toStreamingThisMonthQuery,
} from '../streaming-browse';
import { StreamingQueryService } from '../streaming-query.service';

const PROVIDER_CARD_COUNT = 3;

/** Holds no state of its own: the hub is derived from the provider catalog and preview requests. */
@Injectable()
export class StreamingHubStoreService {
    readonly streamingHub$ = this.watchProviderStoreService.catalog$.pipe(
        map(({ loaded, movieProviders, tvProviders }) => {
            const sortedProviders = sortWatchProviders([...movieProviders, ...tvProviders]);
            const thisMonthSection = STREAMING_EDITORIAL_SECTIONS.find(
                (section) => section.slug === STREAMING_THIS_MONTH_SLUG,
            );
            const featuredSection =
                loaded && thisMonthSection
                    ? {
                          ...thisMonthSection,
                          routerLink: ['/watch', 'streaming', 'list', thisMonthSection.slug],
                          isFeatured: true,
                          previews: [] as readonly CardItem[],
                          title: getStreamingThisMonthTitle(),
                          ctaLabel: `Browse ${getCurrentMonthName()} arrivals`,
                          baseQuery: toStreamingThisMonthQuery(thisMonthSection, tvProviders),
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
                    ...STREAMING_EDITORIAL_SECTIONS.filter((section) => section.slug !== STREAMING_THIS_MONTH_SLUG).map(
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
                // `forkJoin` completes without emitting for an empty list, which would drop the whole hub.
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
