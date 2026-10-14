import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SkeletonComponent } from '../../../shared';

@Component({
    selector: 'app-user-list-card-skeleton',
    imports: [SkeletonComponent],
    templateUrl: './user-list-card-skeleton.component.html',
    styleUrl: './user-list-card-skeleton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListCardSkeletonComponent {}
