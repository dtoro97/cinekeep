import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PersonListItem } from '../../models';
import { ImageComponent } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-person-list-item',
    templateUrl: './person-list-item.component.html',
    styleUrl: './person-list-item.component.scss',
    imports: [RouterLink, ImageComponent, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonListItemComponent {
    @Input() person: PersonListItem | null = null;
    /** A rank shown before the portrait; also reserves the rank column while loading. */
    @Input() index: number | null = null;
    @Input() loading = false;
}
