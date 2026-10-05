import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { PAGE_SIZE } from '../../../constants';
import type { CardItem } from '../../models';
import { CarouselItemsPipe } from '../../pipes/carousel-items.pipe';
import type { RemoteData } from '../../types';
import { BackdropCardComponent } from '../backdrop-card/backdrop-card.component';
import { CardComponent, CardDateFormat } from '../card/card.component';
import { CarouselComponent } from '../carousel/carousel.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export type MediaCarouselPanelVariant = 'card' | 'backdrop';

@Component({
    selector: 'app-media-carousel-panel',
    imports: [BackdropCardComponent, CardComponent, CarouselComponent, CarouselItemsPipe, SkeletonComponent],
    templateUrl: './media-carousel-panel.component.html',
    styleUrl: './media-carousel-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaCarouselPanelComponent {
    @Input({ required: true }) state!: RemoteData<CardItem[]>;
    @Input() ariaLabel = 'Media carousel';
    @Input() dateFormat: CardDateFormat = 'year';
    @Input() imageParams?: string;
    @Input() showRating = true;
    @Input() showDate = false;
    @Input() variant: MediaCarouselPanelVariant = 'card';
    @Input() columns: number | null = null;
    @Input() skeletonCount = PAGE_SIZE;
}
