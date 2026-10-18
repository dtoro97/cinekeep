import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';

import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';
import { HeaderAccountMenuStoreService } from './header-account-menu-store.service';

@Component({
    selector: 'app-header-account-menu',
    imports: [AsyncPipe, MatIconModule, MatMenuModule, RouterLink, UserAvatarComponent],
    templateUrl: './header-account-menu.component.html',
    styleUrl: './header-account-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [HeaderAccountMenuStoreService],
})
export class HeaderAccountMenuComponent {
    readonly account$ = this.headerAccountMenuStoreService.account$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly headerAccountMenuStoreService: HeaderAccountMenuStoreService,
    ) {}

    loadCounts(): void {
        this.headerAccountMenuStoreService.loadCounts$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    startLogin(): void {
        this.headerAccountMenuStoreService.startLogin$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    signOut(): void {
        this.headerAccountMenuStoreService.signOut$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
