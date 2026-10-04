import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { MEDIUM_LIST_COUNT } from '../../../constants';
import { RemoteData } from '../../types';
import { PersonListItem } from '../../models';
import { RepeatPipe } from '../../pipes/repeat.pipe';
import { PersonListItemComponent } from '../person-list-item/person-list-item.component';

@Component({
    selector: 'app-person-list',
    imports: [NgTemplateOutlet, PersonListItemComponent, RepeatPipe],
    templateUrl: './person-list.component.html',
    styleUrl: './person-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonListComponent {
    @Input({ required: true }) state!: RemoteData<PersonListItem[]>;
    @Input() skeletonCount = MEDIUM_LIST_COUNT;
    @Input() indexStart = 1;
    @Input() showIndex = true;
}
