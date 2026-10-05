import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, EMPTY, map, switchMap } from 'rxjs';

import { PersonDetailStoreService } from './person-detail-store.service';

@Component({
    selector: 'app-person-detail-wrapper',
    imports: [RouterOutlet],
    providers: [PersonDetailStoreService],
    template: '<router-outlet />',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailWrapperComponent {
    constructor(
        private store: PersonDetailStoreService,
        private router: Router,
        activatedRoute: ActivatedRoute,
    ) {
        activatedRoute.paramMap
            .pipe(
                map((paramMap) => Number(paramMap.get('personId'))),
                distinctUntilChanged(),
                switchMap((personId) => {
                    if (!Number.isInteger(personId) || personId <= 0) {
                        this.router.navigate(['not-found']);
                        return EMPTY;
                    }

                    return this.store.getPerson$(personId);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
