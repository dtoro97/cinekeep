import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PersonCardItem } from '../../models';
import { ImageComponent } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-person-card',
    imports: [ImageComponent, RouterLink, SkeletonComponent],
    templateUrl: './person-card.component.html',
    styleUrl: './person-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCardComponent {
    @Input() person: PersonCardItem | null = null;
    @Input() loading = false;
    @Input() rank: number | null = null;
}
