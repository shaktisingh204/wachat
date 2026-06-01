// PORT-NOTE: database-command.module.ts — NestJS DatabaseCommandModule wiring.
// In SabNode (Next.js + Mongo) there is no NestJS DI container. This registry
// lists every provider / sub-module that the original module assembled so that
// porting work can track which commands and services need equivalents.

export const DATABASE_COMMAND_MODULE_PROVIDERS = [
  'DataSeedWorkspaceCommand',
  'ConfirmationQuestion',
  'CronRegisterAllCommand',
  'GenerateInstanceCommandCommand',
  'InstanceCommandGenerationService',
  'RunInstanceCommandsCommand',
  'ListOrphanedWorkspaceEntitiesCommand',
  'EnterpriseKeyValidationCronCommand',
  'RotateSigningKeysCronCommand',
  'GenerateApiKeyCommand',
  'UpgradeStatusCommand',
  'RebuildApplicationDefaultDepsCommand',
  'InstallPreInstalledAppsCommand',
] as const;

export const DATABASE_COMMAND_MODULE_IMPORTS = [
  'UpgradeVersionCommandModule',
  'WorkspaceExportModule',
  // Cron command dependencies
  'MessagingImportManagerModule',
  'CalendarEventImportManagerModule',
  'AutomatedTriggerModule',
  'FileModule',
  'WorkspaceModule',
  'WorkflowRunQueueModule',
  // Data seeding
  'TypeORMModule',
  'FieldMetadataModule',
  'ObjectMetadataModule',
  'DevSeederModule',
  'WorkspaceManagerModule',
  'WorkspaceCacheStorageModule',
  'ApiKeyModule',
  'FeatureFlagModule',
  'WorkspaceCleanerModule',
  'WorkspaceMigrationModule',
  'TrashCleanupModule',
  'PublicDomainModule',
  'EventLogCleanupModule',
  'EnterpriseModule',
  'TwentyConfigModule',
  'MarketplaceModule',
  'ApplicationUpgradeModule',
  'StaleRegistrationCleanupModule',
  'PreInstalledAppsModule',
  'WorkspaceIteratorModule',
  'ApplicationModule',
  'WorkspaceCacheModule',
  'WorkspaceVersionModule',
  'UpgradeModule',
  'SecretEncryptionRotationModule',
] as const;
