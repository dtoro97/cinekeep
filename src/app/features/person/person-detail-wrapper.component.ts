import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { combineLatest, distinctUntilChanged, EMPTY, map, startWith, Subject, switchMap } from 'rxjs';

import { PageErrorComponent } from '../../shared';
import { PersonDetailStoreService } from './person-detail-store.service';

@Component({
    selector: 'app-person-detail-wrapper',
    imports: [AsyncPipe, PageErrorComponent, RouterOutlet],
    providers: [PersonDetailStoreService],
    templateUrl: './person-detail-wrapper.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailWrapperComponent {
    readonly showPageError$ = this.store.showPageError$;

    private readonly retryRequests = new Subject<void>();

    constructor(
        private store: PersonDetailStoreService,
        private router: Router,
        activatedRoute: ActivatedRoute,
    ) {
        combineLatest([
            activatedRoute.paramMap.pipe(
                map((paramMap) => Number(paramMap.get('personId'))),
                distinctUntilChanged(),
            ),
            this.retryRequests.pipe(startWith(undefined)),
        ])
            .pipe(
                switchMap(([personId]) => {
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

    retry(): void {
        this.retryRequests.next();
    }
}
