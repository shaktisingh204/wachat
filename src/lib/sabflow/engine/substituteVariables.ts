/**
 * Replaces all `{{variableName}}` placeholders in a string with values from
 * the variables map. Unknown placeholders are left as-is so callers can see
 * which tokens did not resolve.
 *
 * **Browser-safe by design.** This module is imported transitively by chat
 * components that are bundled to the browser, so it deliberately avoids the
 * n8n expression engine (which depends on Node-only packages like
 * `isolated-vm`, `esprima-next`, `jsonrepair`, etc.).
 *
 * For server-side code that wants the full n8n expression engine — `$json`,
 * `$vars`, `$now`, method chaining, Luxon dates, JMESPath — import
 * `evaluateExpression` / `resolveValue` directly from
 * `@/lib/sabflow/n8n/expression-runner` (or from `@/lib/sabflow/n8n`).
 * Those modules must only be reached from API routes / server actions.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string | undefined>,
): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, name: string) => {
    const trimmed = name.trim();
    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
      const v = variables[trimmed];
      return v ?? '';
    }
    return match;
  });
}
