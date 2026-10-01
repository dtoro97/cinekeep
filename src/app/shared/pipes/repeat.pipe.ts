import { Pipe, PipeTransform } from '@angular/core';

/** `3 | repeat` → `[0, 1, 2]`, for rendering a fixed number of placeholders. */
@Pipe({ name: 'repeat' })
export class RepeatPipe implements PipeTransform {
    transform(count: number): number[] {
        return Array.from({ length: count }, (_, index) => index);
    }
}
