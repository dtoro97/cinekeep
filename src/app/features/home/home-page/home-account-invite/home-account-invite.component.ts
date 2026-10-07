import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { SigninDialogService } from '../../../../shared';

@Component({
    selector: 'app-home-account-invite',
    imports: [MatButtonModule],
    templateUrl: './home-account-invite.component.html',
    styleUrl: './home-account-invite.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAccountInviteComponent {
    constructor(
        private destroyRef: DestroyRef,
        private signinDialogService: SigninDialogService,
    ) {}

    openSignin(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
