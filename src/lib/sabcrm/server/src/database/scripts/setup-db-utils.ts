// PORT-NOTE: Ported from twenty-server database/scripts/setup-db-utils.ts
// The original uses TypeORM's rawDataSource (Postgres). In SabNode these
// helpers are kept for use in CRM export/migration scripts that may still
// talk to Postgres directly. connectToDatabase (MongoDB) is the primary
// SabNode data layer.

export const camelToSnakeCase = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * Executes a raw query against a Postgres data source and optionally logs the
 * result. Pass `rawDataSource` from `core.datasource.ts`.
 *
 * PORT-NOTE: The `dataSource` parameter replaces the module-level singleton
 * from the original so callers can supply their own connection.
 */
export const performQuery = async <T = unknown>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSource: { query: (sql: string, params?: unknown[]) => Promise<any> },
  query: string,
  consoleDescription: string,
  withLog = true,
  ignoreAlreadyExistsError = false,
): Promise<T | undefined> => {
  try {
    const result: T = await dataSource.query(query);

    if (withLog) {
      console.log(`Performed '${consoleDescription}' successfully`);
    }

    return result;
  } catch (err) {
    let message = '';

    if (ignoreAlreadyExistsError && `${err}`.includes('already exists')) {
      message = `Performed '${consoleDescription}' successfully`;
    } else {
      message = `Failed to perform '${consoleDescription}': ${err}`;
    }

    if (withLog) {
      console.error(message);
    }

    return undefined;
  }
};
