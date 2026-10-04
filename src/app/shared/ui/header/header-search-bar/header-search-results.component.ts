import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ImageComponent } from '../../image/image.component';
import { RatingComponent } from '../../rating/rating.component';
import { SkeletonComponent } from '../../skeleton/skeleton.component';
import { HeaderSearchPanel } from './header-search.model';

@Component({
    selector: 'app-header-search-results',
    imports: [RouterLink, MatButtonModule, MatIconModule, ImageComponent, RatingComponent, SkeletonComponent],
    templateUrl: './header-search-results.component.html',
    styleUrl: './header-search-results.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderSearchResultsComponent {
    @Input({ required: true }) panel!: HeaderSearchPanel;
    @Input({ required: true }) listboxId!: string;
    @Input() activeOptionId: string | null = null;
    @Output() readonly optionSelected = new EventEmitter<void>();
    @Output() readonly retry = new EventEmitter<void>();
    @Output() readonly widen = new EventEmitter<void>();

    readonly skeletonRows = Array.from({ length: 5 });

    selectOption(): void {
        this.optionSelected.emit();
    }

    retrySearch(): void {
        this.retry.emit();
    }

    widenSearch(): void {
        this.widen.emit();
    }
}
