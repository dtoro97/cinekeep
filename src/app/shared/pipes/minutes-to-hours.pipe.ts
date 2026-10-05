import { Pipe, PipeTransform } from '@angular/core';

/** `125 | m2h` → `2h 5min`. */
@Pipe({ name: 'm2h' })
export class MinutesToHoursPipe implements PipeTransform {
    transform(value: number): string {
        const hours = Math.floor(value / 60);
        const minutes = Math.floor(value % 60);

        if (hours && minutes) {
            return `${hours}h ${minutes}min`;
        }

        if (hours) {
            return `${hours}h`;
        }

        return `${minutes}min`;
    }
}
