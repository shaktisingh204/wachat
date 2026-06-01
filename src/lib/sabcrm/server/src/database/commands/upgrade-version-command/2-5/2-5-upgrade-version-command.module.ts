// PORT-NOTE: The original NestJS module wired together:
//   - WorkspaceCacheModule, WorkspaceIteratorModule
//   - WorkspaceSchemaManagerModule, WorkspaceMigrationModule
//   - RebuildUniquePhoneIndexesCommand, NormalizeCompositeFieldDefaultsCommand (providers)
//
// SabNode has no NestJS DI container. This registry re-exports the ported
// command functions registered under v2.5 upgrade logic.

export {
  up as addRelationTargetFieldMetadataIdToViewFilterEarlyUp,
  down as addRelationTargetFieldMetadataIdToViewFilterEarlyDown,
} from './2-5-instance-command-fast-1747234500000-add-relation-target-field-metadata-id-to-view-filter';

export {
  up as addSubFieldNameToViewSortUp,
  down as addSubFieldNameToViewSortDown,
} from './2-5-instance-command-fast-1778502963794-add-sub-field-name-to-view-sort';

export {
  up as addIsInternalMessagesImportEnabledUp,
  down as addIsInternalMessagesImportEnabledDown,
} from './2-5-instance-command-fast-1778525104406-add-is-internal-messages-import-enabled';

export {
  up as createSigningKeyTableUp,
  down as createSigningKeyTableDown,
} from './2-5-instance-command-fast-1778550000000-create-signing-key-table';

export {
  up as dropPostgresCredentialsTableUp,
  down as dropPostgresCredentialsTableDown,
} from './2-5-instance-command-fast-1798500000000-drop-postgres-credentials-table';

export {
  up as encryptConnectedAccountTokensUp,
  down as encryptConnectedAccountTokensDown,
  runDataMigration as encryptConnectedAccountTokensDataMigration,
} from './2-5-instance-command-slow-1798000004000-encrypt-connected-account-tokens';

export {
  up as encryptApplicationVariableUp,
  down as encryptApplicationVariableDown,
  runDataMigration as encryptApplicationVariableDataMigration,
} from './2-5-instance-command-slow-1798000005000-encrypt-application-variable';

export {
  up as encryptApplicationRegistrationVariableUp,
  down as encryptApplicationRegistrationVariableDown,
  runDataMigration as encryptApplicationRegistrationVariableDataMigration,
} from './2-5-instance-command-slow-1798000006000-encrypt-application-registration-variable';

export {
  up as encryptSigningKeyPrivateKeysUp,
  down as encryptSigningKeyPrivateKeysDown,
  runDataMigration as encryptSigningKeyPrivateKeysDataMigration,
} from './2-5-instance-command-slow-1798000007000-encrypt-signing-key-private-keys';

export {
  up as encryptSensitiveConfigStorageUp,
  down as encryptSensitiveConfigStorageDown,
  runDataMigration as encryptSensitiveConfigStorageDataMigration,
} from './2-5-instance-command-slow-1798000008000-encrypt-sensitive-config-storage';

export {
  up as encryptTotpSecretsUp,
  down as encryptTotpSecretsDown,
  runDataMigration as encryptTotpSecretsDataMigration,
} from './2-5-instance-command-slow-1798000009000-encrypt-totp-secrets';

export { rebuildUniquePhoneIndexes } from './2-5-workspace-command-1778000000000-rebuild-unique-phone-indexes.command';
export { normalizeCompositeFieldDefaults } from './2-5-workspace-command-1778000001000-normalize-composite-field-defaults.command';

export const V2_5_UPGRADE_COMMANDS = {
  version: '2.5.0',
  instanceCommands: [
    { timestamp: 1747234500000, name: 'add-relation-target-field-metadata-id-to-view-filter', type: 'fast' },
    { timestamp: 1778502963794, name: 'add-sub-field-name-to-view-sort', type: 'fast' },
    { timestamp: 1778525104406, name: 'add-is-internal-messages-import-enabled', type: 'fast' },
    { timestamp: 1778550000000, name: 'create-signing-key-table', type: 'fast' },
    { timestamp: 1798500000000, name: 'drop-postgres-credentials-table', type: 'fast' },
    { timestamp: 1798000004000, name: 'encrypt-connected-account-tokens', type: 'slow' },
    { timestamp: 1798000005000, name: 'encrypt-application-variable', type: 'slow' },
    { timestamp: 1798000006000, name: 'encrypt-application-registration-variable', type: 'slow' },
    { timestamp: 1798000007000, name: 'encrypt-signing-key-private-keys', type: 'slow' },
    { timestamp: 1798000008000, name: 'encrypt-sensitive-config-storage', type: 'slow' },
    { timestamp: 1798000009000, name: 'encrypt-totp-secrets', type: 'slow' },
  ],
  workspaceCommands: [
    { timestamp: 1778000000000, name: 'rebuild-unique-phone-indexes' },
    { timestamp: 1778000001000, name: 'normalize-composite-field-defaults' },
  ],
};
