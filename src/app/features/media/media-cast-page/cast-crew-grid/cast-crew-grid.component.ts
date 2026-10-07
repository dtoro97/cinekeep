import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, PluralizePipe, RepeatPipe, SkeletonComponent } from '../../../../shared';
import { CreditDepartment, CreditPerson } from '../media-cast-page-store.service';

/** Cast as one grid of people, or crew as one grid per department. */
@Component({
    selector: 'app-cast-crew-grid',
    imports: [ImageComponent, NgTemplateOutlet, PluralizePipe, RepeatPipe, RouterLink, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './cast-crew-grid.component.html',
    styleUrl: './cast-crew-grid.component.scss',
})
export class CastCrewGridComponent {
    readonly loadingRowCount = 12;
    @Input() cast: readonly CreditPerson[] = [];
    @Input() departments: readonly CreditDepartment[] = [];
    @Input() showCast = true;
    @Input() loading = false;
}
