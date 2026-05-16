/**
 * Loads a module at runtime that is intentionally *not* declared as a
 * dependency (optional peer). The specifier is hidden from webpack/turbopack
 * static analysis via `new Function`, so the bundler never tries to resolve
 * it and forge blocks for uninstalled SDKs don't break the build.
 *
 * Throws if the package is not installed at runtime — callers should catch
 * and re-throw a user-facing "install X" message.
 */
const dynamicImport = new Function('m', 'return import(m)') as <T = unknown>(m: string) => Promise<T>;

export function optionalImport<T = unknown>(specifier: string): Promise<T> {
  return dynamicImport<T>(specifier);
}
