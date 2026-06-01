// PORT-NOTE: clickHouse.module.ts — NestJS module wiring for ClickHouseService.
// In SabNode (Next.js + Mongo) there is no NestJS DI container. The equivalent
// is to import ClickHouseService directly from its module path.
// See: src/lib/sabcrm/server/src/database/clickHouse/clickHouse.service.ts

export const CLICK_HOUSE_MODULE_PROVIDERS = [
  'ClickHouseService',
] as const;

export const CLICK_HOUSE_MODULE_EXPORTS = [
  'ClickHouseService',
] as const;
