// PORT-NOTE: command.module.ts — NestJS CommandModule wiring.
// In SabNode (Next.js + Mongo) there is no NestJS CLI runner. This registry
// documents the modules that the Twenty CLI command context imported so that
// equivalent SabNode utilities can be discovered.

export const COMMAND_MODULE_IMPORTS = [
  // Root app module
  'AppModule',
  // Database migration/seed commands
  'DatabaseCommandModule',
  // Metadata modules needed by CLI commands
  'ObjectMetadataModule',
  'FieldMetadataModule',
  // Cleaner utilities
  'WorkspaceCleanerModule',
  'MessagingMessageCleanerModule',
] as const;

export type CommandModuleImport = (typeof COMMAND_MODULE_IMPORTS)[number];
