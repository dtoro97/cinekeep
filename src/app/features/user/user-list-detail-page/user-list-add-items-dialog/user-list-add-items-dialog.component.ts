import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { BadgeComponent, ImageComponent, RepeatPipe, SkeletonComponent } from '../../../../shared';
import {
    UserListAddItemsDialogStoreService,
    UserListAddItemsSearchResult,
} from './user-list-add-items-dialog-store.service';

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
        RepeatPipe,
        SkeletonComponent,
    ],
    providers: [UserListAddItemsDialogStoreService],
    templateUrl: './user-list-add-items-dialog.component.html',
    styleUrl: './user-list-add-items-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListAddItemsDialogComponent {
    readonly skeletonCount = 4;
    readonly queryControl: FormControl<string>;
    readonly addItems$ = this.store.addItems$;

    constructor(
        private readonly store: UserListAddItemsDialogStoreService,
        private readonly dialogRef: MatDialogRef<UserListAddItemsDialogComponent, true | undefined>,
        private readonly destroyRef: DestroyRef,
        @Inject(MAT_DIALOG_DATA) data: UserListAddItemsDialogData,
        formBuilder: NonNullableFormBuilder,
    ) {
        this.queryControl = formBuilder.control('');
        this.store.load(data.listId);
        this.queryControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => this.store.updateQuery(query));
    }

    addItem(item: UserListAddItemsSearchResult): void {
        this.store.addItem$(item).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    close(hasChanges: boolean): void {
        this.dialogRef.close(hasChanges || undefined);
    }
}
