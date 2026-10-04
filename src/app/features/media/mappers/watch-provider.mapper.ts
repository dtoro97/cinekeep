import { WatchProviderItem } from '../../../api';

// TMDb lists tiers and resold channels of one service separately
// ("Netflix", "Netflix Standard with Ads", "Paramount+ Amazon Channel").
const PROVIDER_VARIANT_SUFFIX =
    /\s+(?:(?:standard|basic)\s+)?with\s+ads$|\s+(?:amazon|apple\s+tv|roku\s+premium)\s+channel$/i;

const toProviderBrandKey = (name: string): string =>
    name
        .replace(PROVIDER_VARIANT_SUFFIX, '')
        .toLowerCase()
        .replace(/\bplus\b/g, '+')
        .replace(/[^a-z0-9+]/g, '');

/** Keeps the first (highest display priority) provider of each brand. */
export const dedupeWatchProviders = (providers: readonly WatchProviderItem[]): WatchProviderItem[] => {
    const seen = new Set<string>();

    return providers.filter((provider) => {
        const key = provider.provider_name ? toProviderBrandKey(provider.provider_name) : `id:${provider.provider_id}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};
