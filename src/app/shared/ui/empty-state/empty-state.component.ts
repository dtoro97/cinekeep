import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    selector: 'app-empty-state',
    templateUrl: './empty-state.component.html',
    styleUrl: './empty-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
    @Input({ required: true }) iconClass!: string;
    @Input({ required: true }) text!: string;
    @Input() title?: string;
    @Input() iconStyle: 'badge' | 'plain' = 'badge';
}
