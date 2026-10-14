import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent, MediaCarouselPanelComponent, RepeatPipe, UserAvatarComponent } from '../../../shared';
import { UserListCardSkeletonComponent } from '../user-list-card-skeleton/user-list-card-skeleton.component';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import { UserProfilePageStoreService } from './user-profile-page-store.service';

@Component({
    selector: 'app-user-profile-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        MediaCarouselPanelComponent,
        RepeatPipe,
        RouterLink,
        UserAvatarComponent,
        UserListCardComponent,
        UserListCardSkeletonComponent,
    ],
    providers: [UserProfilePageStoreService],
    templateUrl: './user-profile-page.component.html',
    styleUrl: './user-profile-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfilePageComponent {
    readonly listSkeletonCount = 3;
    readonly userProfile$ = this.store.userProfile$;

    constructor(private readonly store: UserProfilePageStoreService) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();
    }
}
