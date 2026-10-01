import { UserResponse } from '../../api-cinekeep';
import { SessionUser } from '../models';

export function toSessionUser(user: UserResponse): SessionUser {
    if (typeof user.id !== 'number') {
        throw new Error('The account service did not return a valid user id.');
    }

    return {
        id: user.id,
        email: user.email?.trim() || null,
        username: user.username?.trim() || null,
        createdAt: user.createdAt ?? null,
    };
}
