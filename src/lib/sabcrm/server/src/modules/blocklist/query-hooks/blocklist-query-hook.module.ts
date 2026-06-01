// PORT-NOTE: module-wiring — NestJS module has no Next.js equivalent.
// Re-exports all blocklist query-hook pieces so consumers can import from one place.

export { BlocklistCreateManyPreQueryHook, blocklistCreateManyPreQueryHook } from "@/lib/sabcrm/server/src/modules/blocklist/query-hooks/blocklist-create-many.pre-query.hook";
export { BlocklistCreateOnePreQueryHook, blocklistCreateOnePreQueryHook } from "@/lib/sabcrm/server/src/modules/blocklist/query-hooks/blocklist-create-one.pre-query.hook";
export { BlocklistUpdateManyPreQueryHook, blocklistUpdateManyPreQueryHook } from "@/lib/sabcrm/server/src/modules/blocklist/query-hooks/blocklist-update-many.pre-query.hook";
export { BlocklistUpdateOnePreQueryHook, blocklistUpdateOnePreQueryHook } from "@/lib/sabcrm/server/src/modules/blocklist/query-hooks/blocklist-update-one.pre-query.hook";
