export interface SelectOption<TValue = string> {
    readonly label: string;
    readonly value: TValue;
    readonly count?: number | string;
}
