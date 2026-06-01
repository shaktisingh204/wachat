// PORT-NOTE: NestJS @Module wiring. In SabNode there is no DI container;
// this file re-exports the ported command functions so they can be discovered
// and invoked by the SabCRM upgrade runner.

export { backfillRecordPageLayouts } from "./1-23-workspace-command-1780000001500-backfill-record-page-layouts.command";
export { updateGlobalObjectContextCommandMenuItems } from "./1-23-workspace-command-1780000005000-update-global-object-context-command-menu-items.command";

// Instance commands (fast)
export {
  up as addConditionalAvailabilityExpressionToPageLayoutWidgetUp,
  down as addConditionalAvailabilityExpressionToPageLayoutWidgetDown,
} from "./1-23-instance-command-fast-1775654781000-add-conditional-availability-expression-to-page-layout-widget";

export {
  up as addTableWidgetViewTypeUp,
  down as addTableWidgetViewTypeDown,
} from "./1-23-instance-command-fast-1775752190522-add-table-widget-view-type";

export {
  up as addStandalonePageUp,
  down as addStandalonePageDown,
} from "./1-23-instance-command-fast-1775752781995-add-standalone-page";

export {
  up as addGlobalObjectContextToCommandMenuItemAvailabilityTypeUp,
  down as addGlobalObjectContextToCommandMenuItemAvailabilityTypeDown,
} from "./1-23-instance-command-fast-1776090711153-add-global-object-context-to-command-menu-item-availability-type";

export {
  up as addPageLayoutIdToCommandMenuItemUp,
  down as addPageLayoutIdToCommandMenuItemDown,
} from "./1-23-instance-command-fast-1776168404836-add-page-layout-id-to-command-menu-item";

export {
  up as dropWorkspaceVersionColumnUp,
  down as dropWorkspaceVersionColumnDown,
} from "./1-23-instance-command-fast-1785000000000-drop-workspace-version-column";
