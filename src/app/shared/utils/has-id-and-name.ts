/** Narrows a TMDb entity whose optional `id` and `name` are both set. */
export const hasIdAndName = <T extends { readonly id?: number | null; readonly name?: string | null }>(
    entity: T,
): entity is T & { readonly id: number; readonly name: string } => !!entity.id && !!entity.name;
