import { getISODate } from './get-iso-date';

export function pickDailySeededItem<T>(
    items: readonly T[],
    seed: string,
    itemKey: (item: T) => string | number | null | undefined,
    dateKey = getISODate(0),
): T | undefined {
    if (!items.length) {
        return undefined;
    }

    const itemSeed = items.map((item) => String(itemKey(item) ?? '')).join('|');
    return items[hashString(`${dateKey}:${seed}:${itemSeed}`) % items.length];
}

function hashString(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}
