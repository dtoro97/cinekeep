import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, RepeatPipe, SkeletonComponent } from '../../../../shared';
import { CreditPerson } from '../media-cast-page-store.service';

/** People as portrait rows in columns. */
@Component({
    selector: 'app-cast-crew-grid',
    imports: [ImageComponent, RepeatPipe, RouterLink, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './cast-crew-grid.component.html',
    styleUrl: './cast-crew-grid.component.scss',
})
export class CastCrewGridComponent {
    readonly loadingRowCount = 12;
    @Input() people: readonly CreditPerson[] = [];
    @Input() loading = false;
    @Input() label: string | null = null;
}
