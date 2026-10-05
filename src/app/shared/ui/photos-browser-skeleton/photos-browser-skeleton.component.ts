import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { RepeatPipe } from '../../pipes';
import { BrowseToolbarComponent } from '../browse-toolbar/browse-toolbar.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-photos-browser-skeleton',
    imports: [BrowseToolbarComponent, RepeatPipe, SkeletonComponent],
    templateUrl: './photos-browser-skeleton.component.html',
    styleUrl: './photos-browser-skeleton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosBrowserSkeletonComponent {
    @Input() skeletonCount = 9;
}
