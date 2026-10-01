import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { EMPTY, switchMap } from 'rxjs';

import { PersonDetailStoreService } from './person-detail-store.service';

@Component({
    selector: 'app-person-detail-wrapper',
    template: '<router-outlet />',
    imports: [RouterOutlet],
    providers: [PersonDetailStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailWrapperComponent {
    readonly personId = input.required({ transform: numberAttribute });

    constructor(
        private router: Router,
        private personDetailStore: PersonDetailStoreService,
    ) {
        toObservable(this.personId)
            .pipe(
                switchMap((personId) => {
                    if (!Number.isFinite(personId) || personId <= 0) {
                        this.router.navigate(['not-found']);
                        return EMPTY;
                    }

                    return this.personDetailStore.getPersonDetails$(personId);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
