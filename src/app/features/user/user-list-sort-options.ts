import { UserListSortBy } from '../../shared';
import type { SelectOption, SortDirection } from '../../shared';

export type UserListSortOption = SelectOption<UserListSortBy>;

export const DEFAULT_USER_LIST_SORT_BY: UserListSortBy = UserListSortBy.OriginalOrderAsc;
export const DEFAULT_USER_ACCOUNT_SORT_DIRECTION: SortDirection = 'desc';

/** Account pages always sort by date added; only the direction can change. */
export const USER_ACCOUNT_SORT_FIELD = 'created_at';

export const USER_ACCOUNT_SORT_OPTIONS: readonly SelectOption<typeof USER_ACCOUNT_SORT_FIELD>[] = [
    { label: 'Date added', value: USER_ACCOUNT_SORT_FIELD },
];

export const USER_LIST_SORT_OPTIONS: readonly UserListSortOption[] = [
    { label: 'Original order', value: UserListSortBy.OriginalOrderAsc },
    {
        label: 'Original order, newest first',
        value: UserListSortBy.OriginalOrderDesc,
    },
    { label: 'Title A-Z', value: UserListSortBy.TitleAsc },
    { label: 'Title Z-A', value: UserListSortBy.TitleDesc },
    {
        label: 'Release date, oldest first',
        value: UserListSortBy.ReleaseDateAsc,
    },
    {
        label: 'Release date, newest first',
        value: UserListSortBy.ReleaseDateDesc,
    },
    { label: 'Rating, low to high', value: UserListSortBy.VoteAverageAsc },
    { label: 'Rating, high to low', value: UserListSortBy.VoteAverageDesc },
];

/** The list sort fields; each pairs with a direction to form a `UserListSortBy` value. */
export type UserListSortField = 'original_order' | 'title' | 'release_date' | 'vote_average';

export const USER_LIST_SORT_FIELD_OPTIONS: readonly SelectOption<UserListSortField>[] = [
    { label: 'List order', value: 'original_order' },
    { label: 'Title', value: 'title' },
    { label: 'Release date', value: 'release_date' },
    { label: 'Rating', value: 'vote_average' },
];

export interface UserListSort {
    readonly field: UserListSortField;
    readonly direction: SortDirection;
}

const USER_LIST_SORT_VALUES: readonly UserListSortBy[] = Object.values(UserListSortBy);

export const toUserListSort = (sortBy: UserListSortBy): UserListSort => {
    const [field, direction] = sortBy.split('.') as [UserListSortField, SortDirection];
    return { field, direction };
};

export const toUserListSortBy = ({ field, direction }: UserListSort): UserListSortBy =>
    USER_LIST_SORT_VALUES.find((value) => value === `${field}.${direction}`) ?? DEFAULT_USER_LIST_SORT_BY;
