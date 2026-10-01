import { UserListResponse } from '../../api-cinekeep';

export type SortDirection = 'asc' | 'desc';

export type UserListSortBy = UserListResponse.SortByEnum;
export const UserListSortBy = UserListResponse.SortByEnum;
