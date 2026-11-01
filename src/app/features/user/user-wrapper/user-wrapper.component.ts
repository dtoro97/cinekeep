import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterOutlet } from '@angular/router';

import { PageMessageComponent, SigninDialogService, UserSessionStoreService } from '../../../shared';

// The library pages render once the session is restored; signed out, they ask the visitor to sign in in place,
// so signing in lands on the page that was asked for.
@Component({
    selector: 'app-user-wrapper',
    templateUrl: './user-wrapper.component.html',
    imports: [AsyncPipe, MatButtonModule, PageMessageComponent, RouterOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserWrapperComponent {
    readonly authSession$ = this.userSessionStore.authSession$;

    constructor(
        private readonly userSessionStore: UserSessionStoreService,
        private readonly signinDialogService: SigninDialogService,
        private readonly destroyRef: DestroyRef,
    ) {}

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    createAccount(): void {
        this.signinDialogService.open$({ mode: 'register' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
