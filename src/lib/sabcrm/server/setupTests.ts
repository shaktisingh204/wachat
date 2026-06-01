// Jest global type augmentation — adds missing matcher signatures.
// Ported 1:1 from twenty-server/setupTests.ts; no NestJS/Postgres deps.

export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toThrowError(error?: string | RegExp | Error): R;
      toBeCalledTimes(expected: number): R;
    }
  }
}
