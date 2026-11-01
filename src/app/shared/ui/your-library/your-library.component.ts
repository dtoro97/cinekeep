import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

// The Your library block of a catalogue sidebar: an invitation to sign in for visitors, the projected
// personal content once signed in.
@Component({
    selector: 'app-your-library',
    imports: [DatePipe],
    templateUrl: './your-library.component.html',
    styleUrl: './your-library.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YourLibraryComponent {
    @Input({ required: true }) isAuthenticated!: boolean;
    // Follows the Sign in link: "to rate this episode."
    @Input() invite = '';
    @Input() ratedAt: string | null = null;

    @Output() readonly signIn = new EventEmitter<void>();
}
