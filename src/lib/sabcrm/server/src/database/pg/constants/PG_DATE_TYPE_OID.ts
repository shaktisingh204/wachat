// PORT-NOTE: Ported from twenty-server database/pg/constants/PG_DATE_TYPE_OID.ts
// This is a Postgres OID constant used with the `pg` driver's type parser.
// In SabNode (MongoDB), this is only relevant if pg is used as a direct driver
// for export/migration utilities. The constant is preserved for compatibility.

export const PG_DATE_TYPE_OID = 1082;
