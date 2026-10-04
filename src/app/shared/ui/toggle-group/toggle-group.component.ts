import { ChangeDetectionStrategy, Component, computed, EventEmitter, input, Output } from '@angular/core';
import type { SelectOption } from '../../types';

export type ToggleGroupOption = SelectOption<unknown>;

interface ToggleGroupViewOption extends ToggleGroupOption {
    selected: boolean;
}

@Component({
    selector: 'app-toggle-group',
    templateUrl: './toggle-group.component.html',
    styleUrl: './toggle-group.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleGroupComponent {
    readonly options = input<readonly ToggleGroupOption[]>([]);
    readonly selectedValue = input<unknown>();
    readonly selectedValues = input<readonly unknown[]>([]);
    readonly multiple = input(false);
    /** `chips` is a lighter, denser look for long multi-select option sets such as genres. */
    readonly variant = input<'default' | 'chips'>('default');
    @Output() selected = new EventEmitter<unknown | unknown[]>();

    readonly viewOptions = computed<ToggleGroupViewOption[]>(() =>
        this.options().map((option) => ({
            ...option,
            selected: this.multiple()
                ? this.selectedValues().includes(option.value)
                : this.selectedValue() === option.value,
        })),
    );

    onClick(value: unknown): void {
        if (!this.multiple()) {
            this.selected.emit(value);
            return;
        }

        const next = new Set(this.selectedValues());
        if (next.has(value)) {
            next.delete(value);
        } else {
            next.add(value);
        }

        this.selected.emit([...next]);
    }
}
