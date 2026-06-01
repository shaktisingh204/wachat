// PORT-NOTE: The NestJS Logger is replaced by console.log. The decorator
// itself is framework-agnostic TypeScript and works on any class method.
// In Next.js server code, apply @LogExecutionTime() to service class methods
// exactly as in Twenty — or use wrapWithExecutionTime() for plain functions.

/**
 * Method decorator that logs the execution time of the decorated async method.
 */
export function LogExecutionTime(label?: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const loggerPrefix = `${(target as { constructor: { name: string } }).constructor.name}:${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();

      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      const executionTime = end - start;

      if (label !== undefined && label !== null) {
        console.log(
          `[${loggerPrefix}] ${label} execution time: ${executionTime.toFixed(2)}ms`,
        );
      } else {
        console.log(
          `[${loggerPrefix}] Execution time: ${executionTime.toFixed(2)}ms`,
        );
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Wraps a plain async function with execution-time logging.
 * Use when you cannot apply a decorator (e.g., standalone functions).
 */
export function wrapWithExecutionTime<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, label: string): T {
  return (async (...args: unknown[]) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    console.log(`[${label}] Execution time: ${(end - start).toFixed(2)}ms`);
    return result;
  }) as T;
}
