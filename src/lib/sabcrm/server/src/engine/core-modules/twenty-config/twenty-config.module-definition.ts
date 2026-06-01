// PORT-NOTE: module-wiring — NestJS ConfigurableModuleBuilder has no Next.js equivalent.
// This file documents the options contract that TwentyConfigModule.forRoot() accepted
// and re-exports the relevant pieces for use in SabNode.

// In Twenty, this file produced:
//   ConfigurableModuleClass  — NestJS base class for configurable modules (forRoot/forRootAsync)
//   MODULE_OPTIONS_TOKEN     — NestJS injection token for module options
//
// In SabNode there is no module system. The equivalent is:
//   - TwentyConfigService is constructed directly (see twenty-config.service.ts once ported)
//   - Configuration options are passed as plain constructor arguments
//
// We export a plain options type so consumers can stay type-safe.

export type TwentyConfigModuleOptions = {
  /** When true, config variables can also be stored/updated in the database. */
  databaseEnabled?: boolean;
};

// Synthetic token — kept for import compatibility with other ported files that reference it.
export const MODULE_OPTIONS_TOKEN = Symbol('TWENTY_CONFIG_MODULE_OPTIONS');
