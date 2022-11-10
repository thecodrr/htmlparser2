export declare class Attributes {
    static get(text: string, name: string): string | undefined;
    static set(text: string, name: string, value: string): string;
    static toJSON(text: string, lowerCaseAttributeNames?: boolean): Record<string, string>;
    static toString(attr: Record<string, string | true>): string;
}
//# sourceMappingURL=Attributes.d.ts.map