import { pluralize } from './pluralize';

function toPluralized(count: number, unit: string): string {
    return `${pluralize(count, unit)} ago`;
}

export function toRelativeTimeLabelFromMinutes(minutes: number): string {
    if (minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return toPluralized(minutes, 'minute');
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return toPluralized(hours, 'hour');
    }

    const days = Math.floor(hours / 24);
    return toPluralized(days, 'day');
}

export function toUpdatedAtLabel(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return null;
    }

    const timestamp = Date.parse(normalizedValue);

    if (Number.isNaN(timestamp)) {
        return null;
    }

    const diffMs = Date.now() - timestamp;

    if (diffMs < 0) {
        return `Updated ${new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(timestamp)}`;
    }

    const diffMinutes = Math.floor(diffMs / 60000);
    return `Updated ${toRelativeTimeLabelFromMinutes(diffMinutes)}`;
}
