import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { RepeatPipe } from '../../../../pipes/repeat.pipe';
import { ImageComponent } from '../../../image/image.component';
import { RatingComponent } from '../../../rating/rating.component';
import { SkeletonComponent } from '../../../skeleton/skeleton.component';
import { HeaderSearchPanel } from '../header-search.model';

@Component({
    selector: 'app-header-search-results',
    imports: [
        ImageComponent,
        MatButtonModule,
        MatIconModule,
        RatingComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
    ],
    templateUrl: './header-search-results.component.html',
    styleUrl: './header-search-results.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderSearchResultsComponent implements OnChanges {
    @Input({ required: true }) panel!: HeaderSearchPanel;
    @Input({ required: true }) listboxId!: string;
    @Input() activeOptionId: string | null = null;
    @Output() readonly optionSelected = new EventEmitter<void>();
    @Output() readonly retry = new EventEmitter<void>();
    @Output() readonly widen = new EventEmitter<void>();

    readonly skeletonRowCount = 5;

    listPanel: Extract<HeaderSearchPanel, { readonly kind: 'recent' | 'results' }> | null = null;

    ngOnChanges(): void {
        this.listPanel = this.panel.kind === 'recent' || this.panel.kind === 'results' ? this.panel : null;
    }
}
