/**
 * Extracts the version prefix from an upgrade command name.
 *
 * Upgrade command names follow the pattern `<version>_<rest>`.
 * This util returns the substring before the first underscore,
 * which represents the semver-like version string.
 *
 * @example
 * extractVersionFromCommandName("0-42-0_AddColumnFoo") // => "0-42-0"
 * extractVersionFromCommandName("noUnderscore")         // => null
 */
export const extractVersionFromCommandName = (name: string): string | null => {
  const firstUnderscore = name.indexOf("_");

  if (firstUnderscore === -1) {
    return null;
  }

  return name.substring(0, firstUnderscore);
};
