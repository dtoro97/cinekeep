import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UserAvatarSize = 'sm' | 'lg';

@Component({
    selector: 'app-user-avatar',
    templateUrl: './user-avatar.component.html',
    styleUrl: './user-avatar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatarComponent {
    @Input({ required: true }) set name(name: string) {
        const words = name.trim().split(/\s+/).filter(Boolean);

        this.label = name;
        this.initials = (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? 'ME').slice(0, 2)).toUpperCase();
    }
    @Input() size: UserAvatarSize = 'sm';

    label = '';
    initials = '';
}
