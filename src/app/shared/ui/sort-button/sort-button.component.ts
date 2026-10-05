import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import type { SelectOption, SortDirection } from '../../types';

@Component({
    selector: 'app-sort-button',
    imports: [MatIconModule, MatSelectModule],
    templateUrl: './sort-button.component.html',
    styleUrl: './sort-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortButtonComponent<T> implements OnChanges {
    @Input() options: readonly SelectOption<T>[] = [];
    @Input() selectedValue: T | null = null;
    @Input() direction: SortDirection = 'desc';
    @Output() readonly sortChange = new EventEmitter<T>();
    @Output() readonly directionToggle = new EventEmitter<void>();

    isAscending = false;
    directionLabel = 'Switch to ascending sort';

    ngOnChanges(): void {
        this.isAscending = this.direction === 'asc';
        this.directionLabel = this.isAscending ? 'Switch to descending sort' : 'Switch to ascending sort';
    }
}
