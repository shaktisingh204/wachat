/**
 * Optional `@Auditable` class-method decorator.
 *
 * Requires TypeScript's *experimental* decorator emit (`tsconfig.json`
 * → `experimentalDecorators: true`, which the SabNode workspace
 * already enables).  Internally delegates to {@link withAudit} so the
 * runtime semantics are identical to the HOF.
 *
 * Usage:
 *
 * ```ts
 * class ContactsService {
 *     @Auditable({ action: 'contact.update', resource: 'contacts' })
 *     async update(id: string, patch: Partial<Contact>) { … }
 * }
 * ```
 */
import { withAudit, type WithAuditOptions } from './with-audit';

/* ── Types ──────────────────────────────────────────────────────────── */

/**
 * Decorator-friendly options.  We omit the args-typed callbacks because
 * legacy decorators erase generics — callers that need full typing
 * should reach for the `withAudit` HOF instead.
 */
export type AuditableOptions = Omit<
    WithAuditOptions<unknown[], unknown>,
    'captureBefore' | 'captureAfter' | 'metadata'
> & {
    captureBefore?: (ctx: { args: unknown[] }) =>
        | Record<string, unknown>
        | Promise<Record<string, unknown>>
        | undefined;
    captureAfter?: (ctx: { args: unknown[]; result: unknown }) =>
        | Record<string, unknown>
        | Promise<Record<string, unknown>>
        | undefined;
    metadata?: (ctx: { args: unknown[] }) =>
        | Record<string, unknown>
        | Promise<Record<string, unknown>>
        | undefined;
};

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Class-method decorator that emits a compliance audit event for every
 * call.  The decorated method's `this` binding is preserved.
 */
export function Auditable(opts: AuditableOptions) {
    return function decorate(
        _target: unknown,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
        const original = descriptor.value as (...a: unknown[]) => unknown;
        if (typeof original !== 'function') {
            throw new TypeError(
                `@Auditable can only decorate methods (got ${String(propertyKey)})`,
            );
        }

        // Wrap a thin shim so we can preserve `this` at call time.
        let wrapped: ((...a: unknown[]) => Promise<unknown>) | null = null;

        descriptor.value = function patched(this: unknown, ...args: unknown[]) {
            if (!wrapped) {
                wrapped = withAudit(
                    (...inner: unknown[]) =>
                        Promise.resolve(original.apply(this, inner)),
                    opts as WithAuditOptions<unknown[], unknown>,
                );
            }
            return wrapped.apply(this, args);
        };

        return descriptor;
    };
}

/** Re-exported for convenience inside decorator-heavy modules. */
export { withAudit } from './with-audit';
