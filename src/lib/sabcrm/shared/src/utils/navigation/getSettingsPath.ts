import { AppPath } from '@/lib/sabcrm/shared/src/types/AppPath';
import { type SettingsPath } from '@/lib/sabcrm/shared/src/types/SettingsPath';

/**
 * Replaces :param tokens in a path template with values from params.
 * Mirrors react-router-dom generatePath behaviour for the ported utilities.
 */
const generatePath = (
  pathTemplate: string,
  params?: Record<string, string | null>,
): string => {
  if (!params) return pathTemplate;
  return pathTemplate.replace(/:([^/]+)/g, (_, key: string) => {
    const value = params[key];
    return value ?? `:${key}`;
  });
};

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== undefined && value !== null;

export const getSettingsPath = <T extends SettingsPath>(
  to: T,
  params?: Record<string, string | null>,
  queryParams?: Record<string, unknown>,
  hash?: string,
): string => {
  const basePath = `/${AppPath.Settings}/${to}`;
  let path = generatePath(basePath, params);

  if (isDefined(queryParams)) {
    const filteredEntries = Object.entries(queryParams).filter(([, value]) =>
      isDefined(value),
    );

    if (filteredEntries.length > 0) {
      const searchParams = new URLSearchParams(
        filteredEntries.map(([k, v]) => [k, String(v)]),
      );
      path += `?${searchParams.toString()}`;
    }
  }

  if (isDefined(hash)) {
    path += `#${hash.replace(/^#/, '')}`;
  }

  return path;
};
