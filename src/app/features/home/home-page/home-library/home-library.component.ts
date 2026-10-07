import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, RepeatPipe, SkeletonComponent } from '../../../../shared';
import { HomePosterShelfComponent } from '../home-poster-shelf/home-poster-shelf.component';
import { HomeLibrary } from '../home-store.service';

@Component({
    selector: 'app-home-library',
    imports: [
        DatePipe,
        DecimalPipe,
        HomePosterShelfComponent,
        ImageComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
    ],
    templateUrl: './home-library.component.html',
    styleUrl: './home-library.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeLibraryComponent {
    @Input({ required: true }) library!: HomeLibrary;
}
