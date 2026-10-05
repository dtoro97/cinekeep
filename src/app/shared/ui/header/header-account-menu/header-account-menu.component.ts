import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';

import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';
import { HeaderAccountMenuStoreService } from './header-account-menu-store.service';

interface HeaderAccountRoute {
    readonly label: string;
    readonly route: string;
    readonly icon: string;
}

@Component({
    selector: 'app-header-account-menu',
    imports: [AsyncPipe, MatDividerModule, MatIconModule, MatMenuModule, RouterLink, UserAvatarComponent],
    templateUrl: './header-account-menu.component.html',
    styleUrl: './header-account-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [HeaderAccountMenuStoreService],
})
export class HeaderAccountMenuComponent {
    readonly accountRoutes: readonly HeaderAccountRoute[] = [
        { label: 'Watchlist', route: '/me/watchlists', icon: 'bookmark' },
        { label: 'Favorites', route: '/me/favorites', icon: 'favorite' },
        { label: 'Ratings', route: '/me/ratings', icon: 'star' },
        { label: 'Lists', route: '/me/lists', icon: 'format_list_bulleted' },
        { label: 'Create list', route: '/me/lists/new', icon: 'add' },
    ];

    readonly account$ = this.headerAccountMenuStoreService.account$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly headerAccountMenuStoreService: HeaderAccountMenuStoreService,
    ) {}

    startLogin(): void {
        this.headerAccountMenuStoreService.startLogin$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    signOut(): void {
        this.headerAccountMenuStoreService.signOut$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
