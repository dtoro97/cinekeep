import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export type IconButtonTone = 'neutral' | 'accent' | 'danger';

/** `overlay` is the larger scrim-backed button that sits on images, e.g. carousel and photo viewer controls. */
export type IconButtonAppearance = 'plain' | 'overlay';

@Component({
    selector: 'app-icon-button',
    imports: [MatButtonModule, MatTooltipModule],
    templateUrl: './icon-button.component.html',
    styleUrl: './icon-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.icon-button-host--disabled]': 'disabled',
        '[class.icon-button-host--selected]': 'selected',
        '[class.icon-button-host--accent]': 'tone === "accent"',
        '[class.icon-button-host--danger]': 'tone === "danger"',
        '[class.icon-button-host--overlay]': 'appearance === "overlay"',
    },
})
export class IconButtonComponent {
    @Input({ required: true }) ariaLabel!: string;
    @Input() disabled = false;
    @Input() selected = false;
    @Input() title = '';
    @Input() tone: IconButtonTone = 'neutral';
    @Input() appearance: IconButtonAppearance = 'plain';

    @Output() readonly buttonClick = new EventEmitter<void>();
}
