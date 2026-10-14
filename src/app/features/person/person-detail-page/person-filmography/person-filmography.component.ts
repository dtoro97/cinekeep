import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import {
    ImageComponent,
    RatingComponent,
    RemoteData,
    RepeatPipe,
    SkeletonComponent,
    ToggleGroupComponent,
} from '../../../../shared';
import type { PersonCreditMediaFilter, PersonFilmography } from '../../person-detail-store.service';

@Component({
    selector: 'app-person-filmography',
    imports: [
        MatButtonModule,
        RouterLink,
        ImageComponent,
        RatingComponent,
        RepeatPipe,
        SkeletonComponent,
        ToggleGroupComponent,
    ],
    templateUrl: './person-filmography.component.html',
    styleUrl: './person-filmography.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFilmographyComponent {
    @Input({ required: true }) filmography!: RemoteData<PersonFilmography>;

    @Output() departmentChange = new EventEmitter<string>();
    @Output() mediaTypeChange = new EventEmitter<PersonCreditMediaFilter>();
    @Output() expandToggle = new EventEmitter<void>();
}
