import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// Project an action (a button or link) to show it under the text.
@Component({
    selector: 'app-empty-state',
    templateUrl: './empty-state.component.html',
    styleUrl: './empty-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
    // Ignored by the `posters` style, which draws empty poster outlines instead of an icon.
    @Input() iconClass = '';
    @Input({ required: true }) text!: string;
    @Input() title?: string;
    @Input() iconStyle: 'badge' | 'plain' | 'posters' = 'badge';
}
