import { WatchProviderItem, WatchProviderList } from '../../api';

export interface WatchProviderPreview {
    readonly providers: readonly WatchProviderItem[];
    readonly hiddenCount: number;
    readonly link: string | null;
}

// Catalogue sidebars show this many streaming logos, then "+N".
const PROVIDER_PREVIEW_COUNT = 3;

// TMDb lists tiers and resold channels of one service separately
// ("Netflix", "Netflix Standard with Ads", "Paramount+ Amazon Channel").
const PROVIDER_VARIANT_SUFFIX =
    /\s+(?:(?:standard|basic)\s+)?with\s+ads$|\s+(?:amazon|apple\s+tv|roku\s+premium)\s+channel$/i;

// The region's streaming services, the first (highest display priority) provider of each brand.
export const toWatchProviderPreview = (response: WatchProviderList, region: string): WatchProviderPreview | null => {
    const item = response.results?.[region];
    const seenBrands = new Set<string>();
    const providers = (item?.flatrate ?? []).filter((provider) => {
        const brand = provider.provider_name
            ? provider.provider_name
                  .replace(PROVIDER_VARIANT_SUFFIX, '')
                  .toLowerCase()
                  .replace(/\bplus\b/g, '+')
                  .replace(/[^a-z0-9+]/g, '')
            : `id:${provider.provider_id}`;
        const isNew = !seenBrands.has(brand);
        seenBrands.add(brand);
        return isNew;
    });

    return providers.length
        ? {
              providers: providers.slice(0, PROVIDER_PREVIEW_COUNT),
              hiddenCount: Math.max(0, providers.length - PROVIDER_PREVIEW_COUNT),
              link: item?.link ?? null,
          }
        : null;
};
