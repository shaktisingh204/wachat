/**
 * 20ui — public, clean-named surface for the relocated composites.
 *
 * The app shell + bespoke widgets live in `./composites` (pure-20ui, no zoru
 * tokens). The file-manager has moved to `@/components/sabfiles` (SabFiles owns
 * all file UX). Everything is re-exported here under clean 20ui names so the
 * rest of the app never sees a `Zoru*` name.
 */

export {
  // App shell family (high-level SabNode dashboard shell — not the low-level 20ui HomeShell).
  ZoruHomeShell as SabHomeShell,
  ZoruAppSidebar as SabAppSidebar,
  ZoruHeader as SabTopHeader,
  ZoruShell as SabShellRoot,
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
} from './composites';

export { ZORU_APPS as SAB_APPS } from './composites/shell/zoru-apps';
export { applyTheme, useHtmlDark, AppThemeToggle } from './composites/shell/app-theme';

// File-manager — relocated to SabFiles, which owns all file UX.
export {
  ZoruFileUploadCard as FileUploadCard,
  ZoruFilesPage as FilesPage,
  ZoruFileInput as FileInput,
  ZoruFileCardCollections as FileCardCollections,
} from '@/components/sabfiles/file-manager';
export type {
  ZoruFileEntity as FileEntity,
  ZoruFileUploadItem as FileUploadItem,
  ZoruFileCardItem as FileCardItem,
} from '@/components/sabfiles/file-manager';

export type {
  ZoruStatisticsCard1Item as StatisticsCard1Item,
  ZoruActionSearchAction as LegacyActionSearchAction,
  ZoruFullscreenCalendarEvent as LegacyFullscreenCalendarEvent,
  ZoruTagPickerTag as LegacyTagPickerTag,
  ZoruChartTooltipProps as LegacyChartTooltipProps,
  ZoruToastProps as LegacyToastProps,
  ZoruToastActionElement as LegacyToastActionElement,
  ZoruToastInput as LegacyToastInput,
} from './composites';
