import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// A page that has nothing to show but a message: a heading, a line of text, and the projected actions.
@Component({
    selector: 'app-page-message',
    templateUrl: './page-message.component.html',
    styleUrl: './page-message.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageMessageComponent {
    @Input({ required: true }) title!: string;
    @Input({ required: true }) text!: string;
}
