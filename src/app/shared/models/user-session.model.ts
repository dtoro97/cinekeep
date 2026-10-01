/**
 * `unknown` until the browser has tried to restore the session from the refresh cookie.
 * The server render always stays `unknown`, so it never shows a signed-in or signed-out view.
 */
export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

export interface SessionUser {
    readonly id: number;
    readonly email: string | null;
    readonly username: string | null;
    readonly createdAt: string | null;
}

export interface UserSessionState {
    readonly status: AuthStatus;
    readonly accessToken: string | null;
    readonly user: SessionUser | null;
}
