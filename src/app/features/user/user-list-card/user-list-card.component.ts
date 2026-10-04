import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconButtonComponent, ImageComponent, PluralizePipe } from '../../../shared';
import { UserListSummaryItem } from '../user-lists-store.service';

@Component({
    selector: 'app-user-list-card',
    imports: [DatePipe, IconButtonComponent, ImageComponent, NgTemplateOutlet, PluralizePipe, RouterLink],
    templateUrl: './user-list-card.component.html',
    styleUrl: './user-list-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListCardComponent {
    @Input({ required: true }) item!: UserListSummaryItem;
    @Input() actionsEnabled = false;
    /** Renders a static, non-interactive card, e.g. the live preview while creating a list. */
    @Input() preview = false;

    @Output() readonly editList = new EventEmitter<UserListSummaryItem>();
    @Output() readonly deleteList = new EventEmitter<UserListSummaryItem>();
}
