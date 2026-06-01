// PORT-NOTE: The original NestJS module wired together:
//   - BillingModule, FeatureFlagModule, StripeModule (NestJS DI providers)
//   - TypeOrmModule.forFeature([BillingPriceEntity]) (Postgres-specific)
//   - WorkspaceIteratorModule
//   - MigrateToBillingV2Command (provider)
//
// SabNode has no NestJS DI container. This registry re-exports the ported
// command functions that are registered under v2.4 upgrade logic.

export {
  up as addMetadataToBillingPriceUp,
  down as addMetadataToBillingPriceDown,
} from './2-4-instance-command-fast-1777100000000-add-metadata-to-billing-price';

export {
  up as addEmailGroupChannelTypeUp,
  down as addEmailGroupChannelTypeDown,
  MESSAGE_CHANNEL_TYPES,
} from './2-4-instance-command-fast-1778256809018-add-email-group-channel-type';

export {
  up as addApplicationIdToPublicDomainUp,
  down as addApplicationIdToPublicDomainDown,
} from './2-4-instance-command-fast-1798000003000-add-application-id-to-public-domain';

export { migrateToBillingV2 } from './2-4-workspace-command-1797000001000-migrate-to-billing-v2.command';

export const V2_4_UPGRADE_COMMANDS = {
  version: '2.4.0',
  instanceCommands: [
    {
      timestamp: 1777100000000,
      name: 'add-metadata-to-billing-price',
    },
    {
      timestamp: 1778256809018,
      name: 'add-email-group-channel-type',
    },
    {
      timestamp: 1798000003000,
      name: 'add-application-id-to-public-domain',
    },
  ],
  workspaceCommands: [
    {
      timestamp: 1797000001000,
      name: 'migrate-to-billing-v2',
    },
  ],
};
