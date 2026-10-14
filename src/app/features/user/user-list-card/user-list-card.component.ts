import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconButtonComponent, ImageComponent, PluralizePipe } from '../../../shared';
import { UserListSummaryItem } from '../user-list-summary.mapper';

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
    // A static, non-interactive card: the live preview while creating a list.
    @Input() preview = false;

    @Output() readonly editList = new EventEmitter<UserListSummaryItem>();
    @Output() readonly deleteList = new EventEmitter<UserListSummaryItem>();
}
