import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

@Component({
    selector: 'app-stepper-input',
    templateUrl: './stepper-input.component.html',
    styleUrl: './stepper-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperInputComponent {
    @Input() value: number | null = null;
    @Input() step = 1;
    @Input() min = 0;
    @Input() max = 100;
    @Input() placeholder = '';
    @Input() wide = false;
    /** The value an empty field steps to first; without it, stepping down starts at `max` and up at `min`. */
    @Input() start: number | null = null;

    @Output() valueChanged = new EventEmitter<number | null>();

    onDecrement(): void {
        const next = this.value === null ? (this.start ?? this.max) : this.value - this.step;
        this.valueChanged.emit(next < this.min ? null : next);
    }

    onIncrement(): void {
        const next = this.value === null ? (this.start ?? this.min) : this.value + this.step;
        this.valueChanged.emit(next > this.max ? this.max : next);
    }

    onInputChange(event: Event): void {
        const raw = (event.target as HTMLInputElement).value;
        const parsed = raw ? Number.parseFloat(raw) : null;
        this.valueChanged.emit(
            parsed !== null && !Number.isNaN(parsed) ? parsed : null,
        );
    }
}
