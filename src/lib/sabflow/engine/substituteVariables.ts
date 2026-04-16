/**
 * Replaces all {{variableName}} placeholders in a string with the
 * corresponding values from the variables map.  Unknown variables are left
 * as-is so callers can still see which placeholders were not resolved.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => {
    const trimmed = name.trim();
    return Object.prototype.hasOwnProperty.call(variables, trimmed)
      ? variables[trimmed]
      : _match;
  });
}
