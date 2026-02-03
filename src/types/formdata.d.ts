// Type declarations for server actions with FormData
// This file extends the global FormData interface for server actions

declare global {
    interface FormData {
        get(name: string): FormDataEntryValue | null;
        getAll(name: string): FormDataEntryValue[];
        has(name: string): boolean;
        set(name: string, value: string | Blob, fileName?: string): void;
        append(name: string, value: string | Blob, fileName?: string): void;
        delete(name: string): void;
        forEach(
            callbackfn: (value: FormDataEntryValue, key: string, parent: FormData) => void,
            thisArg?: any
        ): void;
        entries(): IterableIterator<[string, FormDataEntryValue]>;
        keys(): IterableIterator<string>;
        values(): IterableIterator<FormDataEntryValue>;
        [Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]>;
    }
}

export { };
