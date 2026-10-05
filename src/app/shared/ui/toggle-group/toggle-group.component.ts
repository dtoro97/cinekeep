import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import type { SelectOption } from '../../types';

@Component({
    selector: 'app-toggle-group',
    templateUrl: './toggle-group.component.html',
    styleUrl: './toggle-group.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleGroupComponent<T> implements OnChanges {
    @Input() options: readonly SelectOption<T>[] = [];
    @Input() selectedValue: T | null = null;
    @Input() selectedValues: readonly T[] = [];
    @Input() multiple = false;
    @Input() variant: 'default' | 'chips' = 'default';
    @Output() readonly selected = new EventEmitter<T>();
    @Output() readonly selectedValuesChange = new EventEmitter<T[]>();

    hasOptions = false;
    showChips = false;
    viewOptions: Array<SelectOption<T> & { readonly isSelected: boolean }> = [];

    ngOnChanges(): void {
        this.hasOptions = this.options.length > 0;
        this.showChips = this.variant === 'chips';
        this.viewOptions = this.options.map((option) => ({
            ...option,
            isSelected: this.multiple
                ? this.selectedValues.includes(option.value)
                : this.selectedValue === option.value,
        }));
    }

    toggle(value: T): void {
        if (!this.multiple) {
            this.selected.emit(value);
            return;
        }

        this.selectedValuesChange.emit(
            this.selectedValues.includes(value)
                ? this.selectedValues.filter((selectedValue) => selectedValue !== value)
                : [...this.selectedValues, value],
        );
    }
}
