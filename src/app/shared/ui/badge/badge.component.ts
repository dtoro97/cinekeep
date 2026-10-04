import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'accent' | 'outline';

@Component({
    selector: 'app-badge',
    templateUrl: './badge.component.html',
    styleUrl: './badge.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
    @Input({ required: true }) label!: string;
    @Input() iconClass: string | null = null;
    @Input() variant: BadgeVariant = 'neutral';
}
