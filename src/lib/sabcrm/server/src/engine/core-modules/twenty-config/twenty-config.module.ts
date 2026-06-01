// PORT-NOTE: module-wiring — NestJS module has no Next.js equivalent.
// Re-exports the ported service and related pieces for use across the SabCRM layer.

export { TwentyConfigService } from './twenty-config.service';
export { ConfigGroupHashService } from './services/config-group-hash.service';

// The IS_CONFIG_VARIABLES_IN_DB_ENABLED flag can be read directly from
// process.env in the consuming code; no DI container is needed.
export const IS_CONFIG_VARIABLES_IN_DB_ENABLED =
  process.env.IS_CONFIG_VARIABLES_IN_DB_ENABLED !== 'false';
