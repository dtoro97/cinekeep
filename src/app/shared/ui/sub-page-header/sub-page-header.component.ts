import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroSurfaceComponent } from '../hero-surface/hero-surface.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-sub-page-header',
    imports: [HeroSurfaceComponent, NgTemplateOutlet, RouterLink, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sub-page-header.component.html',
    styleUrl: './sub-page-header.component.scss',
})
export class SubPageHeaderComponent {
    /** When set, the header sits on a short strip of the title's backdrop, like the detail heroes. */
    @Input() backdropPath: string | null | undefined = null;
    @Input() parentTitle: string | null = null;
    @Input() backLink: string | readonly (string | number)[] | null = ['../'];
    @Input() pageTitle: string | null = null;
    @Input() subtitle: string | null = null;
    @Input() loading = false;
}
