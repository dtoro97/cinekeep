import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

@Component({
    selector: 'app-stepper-input',
    templateUrl: './stepper-input.component.html',
    styleUrl: './stepper-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperInputComponent implements OnChanges {
    @Input() value: number | null = null;
    @Input() step = 1;
    @Input() min = 0;
    @Input() max = 100;
    @Input() placeholder = '';
    /** The value an empty field steps to first; without it, stepping down starts at `max` and up at `min`. */
    @Input() start: number | null = null;

    @Output() readonly valueChanged = new EventEmitter<number | null>();

    decrementLabel = 'Decrease value';
    incrementLabel = 'Increase value';

    ngOnChanges(): void {
        const label = this.placeholder.toLowerCase() || 'value';
        this.decrementLabel = `Decrease ${label}`;
        this.incrementLabel = `Increase ${label}`;
    }

    decrement(): void {
        const next = this.value === null ? (this.start ?? this.max) : this.value - this.step;
        this.valueChanged.emit(next < this.min ? null : next);
    }

    increment(): void {
        const next = this.value === null ? (this.start ?? this.min) : this.value + this.step;
        this.valueChanged.emit(next > this.max ? this.max : next);
    }

    changeValue(event: Event): void {
        const inputValue = (event.target as HTMLInputElement).value;
        const parsedValue = inputValue ? Number.parseFloat(inputValue) : null;
        this.valueChanged.emit(parsedValue !== null && !Number.isNaN(parsedValue) ? parsedValue : null);
    }
}
