// PORT-NOTE: NestJS @Module wiring. In SabNode there is no DI container;
// this file re-exports the ported command functions so they can be discovered
// and invoked by the SabCRM upgrade runner.

export { addSendEmailRecordSelectionCommandMenuItems } from "./1-22-workspace-command-1775500016000-add-send-email-record-selection-command-menu-items.command";
export { backfillStandardSkills } from "./1-22-workspace-command-1780000002000-backfill-standard-skills.command";
export { fixMergeCommandSelectAll } from "./1-22-workspace-command-1780000003000-fix-merge-command-select-all.command";

// Instance commands (fast)
export {
  up as addPermissionFlagRoleIdIndexUp,
  down as addPermissionFlagRoleIdIndexDown,
} from "./1-22-instance-command-fast-1775749486425-add-permission-flag-role-id-index";

export {
  up as addWorkspaceIdToIndirectEntitiesUp,
  down as addWorkspaceIdToIndirectEntitiesDown,
} from "./1-22-instance-command-fast-1775758621017-add-workspace-id-to-indirect-entities";

export {
  up as addWorkspaceIdIndexesAndFksUp,
  down as addWorkspaceIdIndexesAndFksDown,
} from "./1-22-instance-command-fast-1775761294897-add-workspace-id-indexes-and-fks-to-indirect-entities";

export {
  up as dropObjectMetadataDataSourceFkUp,
  down as dropObjectMetadataDataSourceFkDown,
} from "./1-22-instance-command-fast-1775804361516-drop-object-metadata-data-source-fk";

export {
  up as addCreditBalanceToBillingCustomerUp,
  down as addCreditBalanceToBillingCustomerDown,
} from "./1-22-instance-command-fast-1776078919203-add-credit-balance-to-billing-customer";

// Instance commands (slow)
export {
  runDataMigration as backfillWorkspaceIdOnIndirectEntitiesDataMigration,
  up as backfillWorkspaceIdOnIndirectEntitiesUp,
  down as backfillWorkspaceIdOnIndirectEntitiesDown,
} from "./1-22-instance-command-slow-1775758621018-backfill-workspace-id-on-indirect-entities";
