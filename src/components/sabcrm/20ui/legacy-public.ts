/**
 * 20ui — public, clean-named surface for the relocated legacy components.
 *
 * These components (app shell, file-manager, a few bespoke widgets) have no
 * drop-in 20ui equivalent yet, so their implementations live in `./legacy`
 * (formerly the `zoru/` folder). They are re-exported here under clean 20ui
 * names so the rest of the app never sees a `Zoru*` name or the `compat` bridge.
 *
 * Behavior is identical to the originals — only the names changed. A follow-up
 * can rebuild them to the 20ui visual language; until then they keep their
 * existing styling (see `legacy.css`).
 */

export {
  // App shell family (high-level SabNode dashboard shell — not the low-level 20ui HomeShell).
  ZoruHomeShell as SabHomeShell,
  ZoruAppSidebar as SabAppSidebar,
  ZoruHeader as SabTopHeader,
  ZoruShell as SabShellRoot,
  // File-manager (no 20ui equivalent; SabFiles owns file UX, this is the manager surface).
  ZoruFileUploadCard as FileUploadCard,
  ZoruFilesPage as FilesPage,
  ZoruFileInput as FileInput,
  ZoruFileCardCollections as FileCardCollections,
  // Bespoke widgets.
  ZoruAccordion03 as Accordion03,
  ZoruAccordion03Item as Accordion03Item,
  ZoruAccordion03Trigger as Accordion03Trigger,
  ZoruAccordion03Content as Accordion03Content,
  ZoruStatisticsCard1 as StatisticsCard1,
  ZoruDynamicSelector as DynamicSelector,
  ZoruBouncyToggle as BouncyToggle,
  ZoruLimelightNav as LimelightNav,
  ZoruStarIcon as StarIcon,
  ZoruProvider as SabScopeProvider,
  zoruBadgeVariants as badgeVariants,
  zoruButtonVariants as buttonVariants,
  SabnodeWaterLoader,
  SabNodeSidebar,
} from './legacy';

export { ZORU_APPS as SAB_APPS } from './legacy/shell/zoru-apps';
export { applyTheme, useHtmlDark, AppThemeToggle } from './legacy/shell/app-theme';

export type {
  ZoruFileEntity as FileEntity,
  ZoruFileUploadItem as FileUploadItem,
  ZoruFileCardItem as FileCardItem,
  ZoruStatisticsCard1Item as StatisticsCard1Item,
  ZoruActionSearchAction as LegacyActionSearchAction,
  ZoruFullscreenCalendarEvent as LegacyFullscreenCalendarEvent,
  ZoruTagPickerTag as LegacyTagPickerTag,
  ZoruChartTooltipProps as LegacyChartTooltipProps,
  ZoruToastProps as LegacyToastProps,
  ZoruToastActionElement as LegacyToastActionElement,
  ZoruToastInput as LegacyToastInput,
} from './legacy';
