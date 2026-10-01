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
