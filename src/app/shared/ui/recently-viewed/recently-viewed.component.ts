import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RecentlyViewedStoreService } from '../../services';
import { CardComponent } from '../card/card.component';
import { CarouselComponent } from '../carousel/carousel.component';
import { PersonCardComponent } from '../person-card/person-card.component';

@Component({
    selector: 'app-recently-viewed',
    imports: [AsyncPipe, CardComponent, CarouselComponent, PersonCardComponent],
    templateUrl: './recently-viewed.component.html',
    styleUrl: './recently-viewed.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentlyViewedComponent {
    readonly recentlyViewed$ = this.recentlyViewedStoreService.recentlyViewed$;

    constructor(private readonly recentlyViewedStoreService: RecentlyViewedStoreService) {}

    clearAll(): void {
        this.recentlyViewedStoreService.clearAll();
    }
}
