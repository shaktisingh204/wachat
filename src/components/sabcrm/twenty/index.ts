export { TwentyAppFrame, default as TwentyAppFrameDefault } from './twenty-app-frame';
export { TwentyAppRail, default as TwentyAppRailDefault } from './twenty-app-rail';
/**
 * @deprecated The workspace switcher moved to
 * `@/components/sabcrm/workspace-switcher` (export `WorkspaceSwitcher`).
 * These aliases remain for one release — import the new path directly.
 */
export {
  WorkspaceSwitcher as TwentyWorkspaceSwitcher,
  default as TwentyWorkspaceSwitcherDefault,
} from '../workspace-switcher';
export {
  TwentyButton,
  TwentyChip,
  TwentyAvatar,
  TwentyPageHeader,
} from './twenty-primitives';
export type {
  TwentyButtonProps,
  TwentyButtonVariant,
  TwentyChipProps,
  TwentyAvatarProps,
  TwentyAvatarSize,
  TwentyAvatarShape,
  TwentyPageHeaderProps,
} from './twenty-primitives';
/**
 * @deprecated The command menu moved to `@/components/sabcrm/command-menu`
 * (export `CommandMenu`, data layer in `command-menu-data.ts`). These aliases
 * remain for one release — import the new path directly.
 */
export {
  CommandMenu as TwentyCommandMenu,
  default as TwentyCommandMenuDefault,
} from '../command-menu';
export type { CommandMenuProps as TwentyCommandMenuProps } from '../command-menu';
export { useCommandMenu, default as useCommandMenuDefault } from './use-command-menu';
export type { UseCommandMenuResult } from './use-command-menu';
export {
  RecordFieldPanel,
  default as RecordFieldPanelDefault,
} from './record-field-panel';
export type { RecordFieldPanelProps } from './record-field-panel';
export {
  RecordDetailTabs,
  default as RecordDetailTabsDefault,
} from './record-detail-tabs';
export type { RecordDetailTabsProps } from './record-detail-tabs';
export {
  AutomationBuilder,
  default as AutomationBuilderDefault,
} from './automation-builder';
export type {
  AutomationBuilderProps,
  AutomationDraft,
  AutomationTrigger,
  AutomationTriggerEvent,
  AutomationStep,
  AutomationStepType,
  AutomationObjectOption,
} from './automation-builder';
