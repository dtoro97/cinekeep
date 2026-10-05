/** `[[a1, a2], [b1]]` → `[a1, b1, a2]`: one item from each group in turn, so no group crowds out the others. */
export const interleave = <T>(groups: readonly (readonly T[])[]): T[] =>
    Array.from({ length: Math.max(0, ...groups.map((group) => group.length)) }).flatMap((_, index) =>
        groups.flatMap((group) => (index < group.length ? [group[index]] : [])),
    );
