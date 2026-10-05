import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { MEDIUM_LIST_COUNT } from '../../../../constants';
import {
    CarouselComponent,
    CarouselItemsPipe,
    PersonCardComponent,
    PersonCardItem,
    RemoteData,
} from '../../../../shared';

@Component({
    selector: 'app-person-carousel-panel',
    imports: [CarouselComponent, CarouselItemsPipe, PersonCardComponent],
    templateUrl: './person-carousel-panel.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCarouselPanelComponent {
    @Input({ required: true }) state!: RemoteData<PersonCardItem[]>;
    @Input() skeletonCount = MEDIUM_LIST_COUNT;
}
