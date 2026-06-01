// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type ExcludeFunctions<T> = T extends Function ? never : T;
