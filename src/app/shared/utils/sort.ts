import type { SortDirection } from '../types';
import { isDefined } from './is-defined';

type Sortable = string | number | null | undefined;

/** Ascending order with missing values last; numbers compare by value, everything else as text. */
export const compareValues = (left: Sortable, right: Sortable): number => {
    if (!isDefined(left)) {
        return isDefined(right) ? 1 : 0;
    }

    if (!isDefined(right)) {
        return -1;
    }

    return typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
};

export const sortBy = <T>(items: readonly T[], selector: (item: T) => Sortable, direction: SortDirection = 'asc'): T[] => {
    const factor = direction === 'asc' ? 1 : -1;

    return [...items].sort((left, right) => compareValues(selector(left), selector(right)) * factor);
};
