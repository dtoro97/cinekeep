import { Pipe, PipeTransform } from '@angular/core';

/** Age in whole years at `endDate`, or today when it is unset: `birthday | age: deathday`. */
@Pipe({ name: 'age' })
export class AgePipe implements PipeTransform {
    transform(birthday: string | null | undefined, endDate?: string | null): number | null {
        if (!birthday) {
            return null;
        }

        const days = ((endDate ? new Date(endDate) : new Date()).getTime() - new Date(birthday).getTime()) / 86_400_000;

        return Math.abs(Math.round(days / 365.25));
    }
}
