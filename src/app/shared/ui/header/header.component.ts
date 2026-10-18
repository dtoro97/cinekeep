import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SigninDialogService } from '../signin-dialog/signin-dialog.service';
import { HeaderAccountMenuComponent } from './header-account-menu/header-account-menu.component';
import { HeaderLocaleRegionMenuComponent } from './header-locale-region-menu/header-locale-region-menu.component';
import { HeaderSearchBarComponent } from './header-search-bar/header-search-bar.component';
import { HeaderStoreService } from './header-store.service';

@Component({
    selector: 'app-header',
    imports: [
        AsyncPipe,
        HeaderAccountMenuComponent,
        HeaderLocaleRegionMenuComponent,
        HeaderSearchBarComponent,
        RouterLink,
        RouterLinkActive,
    ],
    providers: [HeaderStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
})
export class HeaderComponent {
    readonly header$ = this.headerStoreService.header$;

    constructor(
        private readonly headerStoreService: HeaderStoreService,
        private readonly signinDialogService: SigninDialogService,
        private readonly destroyRef: DestroyRef,
    ) {}

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
