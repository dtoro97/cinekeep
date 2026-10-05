import { UserListResponse } from '../../api-cinekeep';
import type { SelectOption, SortDirection } from '../../shared';

export type UserListSortOption = SelectOption<UserListResponse.SortByEnum>;

export const DEFAULT_USER_LIST_SORT_BY: UserListResponse.SortByEnum = UserListResponse.SortByEnum.OriginalOrderAsc;
export const DEFAULT_USER_ACCOUNT_SORT_DIRECTION: SortDirection = 'desc';

/** Account pages always sort by date added; only the direction can change. */
export const USER_ACCOUNT_SORT_FIELD = 'created_at';

export const USER_ACCOUNT_SORT_OPTIONS: readonly SelectOption<typeof USER_ACCOUNT_SORT_FIELD>[] = [
    { label: 'Date added', value: USER_ACCOUNT_SORT_FIELD },
];

export const USER_LIST_SORT_OPTIONS: readonly UserListSortOption[] = [
    { label: 'Original order', value: UserListResponse.SortByEnum.OriginalOrderAsc },
    {
        label: 'Original order, newest first',
        value: UserListResponse.SortByEnum.OriginalOrderDesc,
    },
    { label: 'Title A-Z', value: UserListResponse.SortByEnum.TitleAsc },
    { label: 'Title Z-A', value: UserListResponse.SortByEnum.TitleDesc },
    {
        label: 'Release date, oldest first',
        value: UserListResponse.SortByEnum.ReleaseDateAsc,
    },
    {
        label: 'Release date, newest first',
        value: UserListResponse.SortByEnum.ReleaseDateDesc,
    },
    { label: 'Rating, low to high', value: UserListResponse.SortByEnum.VoteAverageAsc },
    { label: 'Rating, high to low', value: UserListResponse.SortByEnum.VoteAverageDesc },
];

/** The list sort fields; each pairs with a direction to form a `UserListResponse.SortByEnum` value. */
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

const USER_LIST_SORT_VALUES: readonly UserListResponse.SortByEnum[] = Object.values(UserListResponse.SortByEnum);

export const toUserListSort = (sortBy: UserListResponse.SortByEnum): UserListSort => {
    const [field, direction] = sortBy.split('.') as [UserListSortField, SortDirection];
    return { field, direction };
};

export const toUserListSortBy = ({ field, direction }: UserListSort): UserListResponse.SortByEnum =>
    USER_LIST_SORT_VALUES.find((value) => value === `${field}.${direction}`) ?? DEFAULT_USER_LIST_SORT_BY;
