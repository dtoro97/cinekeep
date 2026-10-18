import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { HeroSurfaceComponent, LibraryToggleComponent, SkeletonComponent } from '../../../../shared';
import { SpotlightItem } from '../../hero-spotlight/hero-spotlight.component';

@Component({
    selector: 'app-home-spotlight',
    imports: [DecimalPipe, HeroSurfaceComponent, LibraryToggleComponent, MatButtonModule, RouterLink, SkeletonComponent],
    templateUrl: './home-spotlight.component.html',
    styleUrl: './home-spotlight.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSpotlightComponent {
    @Input() loading = false;
    @Input() spotlight: SpotlightItem | null = null;
    @Input() trailerUrl: string | null = null;
}
