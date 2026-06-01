// PORT-NOTE: Ported from twenty-server database/pg/set-pg-date-type-parser.ts
// This configures the `pg` (node-postgres) driver to return date columns as
// plain strings rather than JS Date objects. SabNode uses MongoDB as its
// primary store, but this utility may still be called when direct Postgres
// connections are used for CRM export/migration tooling.
//
// Requires the `pg` package to be available. If `pg` is not installed, this
// module will throw at import time only when called.

import { PG_DATE_TYPE_OID } from '@/lib/sabcrm/server/src/database/pg/constants/PG_DATE_TYPE_OID';

export const setPgDateTypeParser = (): void => {
  // Dynamic require so the build does not fail if `pg` is not installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { types } = require('pg') as typeof import('pg');

  types.setTypeParser(PG_DATE_TYPE_OID, (val: string) => val);
};
