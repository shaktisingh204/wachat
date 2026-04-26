/**
 * Minimal sabflow stub for `@n8n/decorators`.
 *
 * Only the symbols the ported core/ source imports are reproduced. Each
 * decorator is a no-op pass-through so existing TS metadata still resolves
 * but nothing is wired into a real DI/lifecycle registry.
 */

/* ── Memoization ────────────────────────────────────────────────────────── */

/**
 * Caches the return value of a parameterless getter on its instance.
 * Same shape as the upstream `@Memoized` decorator.
 */
export function Memoized<T>(
  _target: object,
  _propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
): TypedPropertyDescriptor<T> | void {
  const original = descriptor.get;
  if (!original) return descriptor;
  const cacheKey = Symbol('memoized');
  descriptor.get = function (this: Record<symbol, unknown>) {
    if (!(cacheKey in this)) {
      this[cacheKey] = original.call(this);
    }
    return this[cacheKey] as T;
  };
  return descriptor;
}

/* ── Context establishment hook (DI metadata) ───────────────────────────── */

export type ContextEstablishmentHookMetadata = {
  hookName: string;
  priority?: number;
};

export interface IContextEstablishmentHook {
  establish(...args: unknown[]): void | Promise<void>;
}

/* ── Generic property/parameter decorators (pass-through) ───────────────── */

export function Body(_: object, __: string | symbol | undefined, ___?: number): void {}
export function Get(): MethodDecorator {
  return () => undefined;
}
export function Post(): MethodDecorator {
  return () => undefined;
}
export function RestController(): ClassDecorator {
  return () => undefined;
}
export function Debounce(_ms: number): MethodDecorator {
  return () => undefined;
}
