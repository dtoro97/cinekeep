import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    selector: 'app-rating',
    imports: [DecimalPipe],
    templateUrl: './rating.component.html',
    styleUrl: './rating.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingComponent {
    @Input({ required: true }) value!: number;
}
