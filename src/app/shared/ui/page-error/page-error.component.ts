import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { PageMessageComponent } from '../page-message/page-message.component';

// Shown in place of a page whose main data failed to load; a missing page goes to not-found instead.
@Component({
    selector: 'app-page-error',
    templateUrl: './page-error.component.html',
    imports: [MatButtonModule, PageMessageComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageErrorComponent {
    @Input({ required: true }) title!: string;
    @Output() readonly retry = new EventEmitter<void>();
}
