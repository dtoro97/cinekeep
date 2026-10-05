export interface SessionUser {
    readonly id: number;
    readonly email: string | null;
    readonly username: string | null;
    readonly createdAt: string | null;
}
