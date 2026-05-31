const padDatePart = (value: number): string => value.toString().padStart(2, '0');

export const toISODate = (date: Date): string =>
    [
        date.getFullYear(),
        padDatePart(date.getMonth() + 1),
        padDatePart(date.getDate()),
    ].join('-');

export const getISODate = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return toISODate(d);
};

export const getCurrentMonthName = (date = new Date()): string =>
    new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);

export const getCurrentMonthDateWindow = (
    date = new Date(),
): { from: string; to: string } => {
    const year = date.getFullYear();
    const month = date.getMonth();

    return {
        from: toISODate(new Date(year, month, 1)),
        to: toISODate(new Date(year, month + 1, 0)),
    };
};
