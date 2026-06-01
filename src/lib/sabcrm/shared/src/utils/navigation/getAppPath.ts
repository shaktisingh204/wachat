import { type AppPath } from '@/lib/sabcrm/shared/src/types/AppPath';

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

export const getAppPath = <T extends AppPath>(
  to: T,
  params?: Record<string, string | null>,
  queryParams?: Record<string, unknown>,
): string => {
  let path: string = generatePath(to as string, params);

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

  return path;
};
