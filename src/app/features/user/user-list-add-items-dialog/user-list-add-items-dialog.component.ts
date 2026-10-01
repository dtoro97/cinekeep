import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';


import { BadgeComponent, ImageComponent, SkeletonComponent } from '../../../shared';
import { UserListAddItemsDialogStore, UserListAddItemsSearchResult } from './user-list-add-items-dialog-store.service';

export interface UserListAddItemsDialogData {
    readonly listId: number;
}

@Component({
    selector: 'app-user-list-add-items-dialog',
    imports: [
        AsyncPipe,
        BadgeComponent,
        ImageComponent,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule,
        SkeletonComponent,
    ],
    templateUrl: './user-list-add-items-dialog.component.html',
    styleUrl: './user-list-add-items-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserListAddItemsDialogStore],
})
export class UserListAddItemsDialogComponent {
    readonly queryControl: FormControl<string>;
    readonly vm$ = this.store.vm$;

    constructor(
        @Inject(MAT_DIALOG_DATA)
        public readonly data: UserListAddItemsDialogData,
        private readonly dialogRef: MatDialogRef<UserListAddItemsDialogComponent, true | undefined>,
        private readonly formBuilder: NonNullableFormBuilder,
        private readonly store: UserListAddItemsDialogStore,
    ) {
        this.queryControl = this.formBuilder.control('');
        this.store.initialize(this.data.listId);
        this.queryControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => this.store.updateQuery(query));
    }

    addItem(item: UserListAddItemsSearchResult): void {
        this.store.addItem$(item).subscribe();
    }

    close(): void {
        this.dialogRef.close(this.store.hasChanges() ? true : undefined);
    }
}
