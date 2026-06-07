/**
 * 20ui — public, clean-named surface for the relocated composites.
 *
 * The app shell + bespoke widgets live in `./composites` (pure-20ui, no zoru
 * tokens). The file-manager has moved to `@/components/sabfiles` (SabFiles owns
 * all file UX). Everything is re-exported here under clean 20ui names so the
 * rest of the app never sees a `Sab*` name.
 */

export {
  // App shell family (high-level SabNode dashboard shell — not the low-level 20ui HomeShell).
  SabHomeShell,
  SabAppSidebar,
  SabHeader as SabTopHeader,
  SabShell as SabShellRoot,
  // Bespoke widgets.
  SabAccordion03 as Accordion03,
  SabAccordion03Item as Accordion03Item,
  SabAccordion03Trigger as Accordion03Trigger,
  SabAccordion03Content as Accordion03Content,
  SabStatisticsCard1 as StatisticsCard1,
  SabDynamicSelector as DynamicSelector,
  SabBouncyToggle as BouncyToggle,
  SabLimelightNav as LimelightNav,
  SabStarIcon as StarIcon,
  SabProvider as SabScopeProvider,
  sabBadgeVariants as badgeVariants,
  sabButtonVariants as buttonVariants,
  SabnodeWaterLoader,
  SabNodeSidebar,
} from './composites';

export { SAB_APPS } from './composites/shell/zoru-apps';
export { applyTheme, useHtmlDark, AppThemeToggle } from './composites/shell/app-theme';

// File-manager — relocated to SabFiles, which owns all file UX.
export {
  SabFileUploadCard as FileUploadCard,
  SabFilesPage as FilesPage,
  SabFileInput as FileInput,
  SabFileCardCollections as FileCardCollections,
} from '@/components/sabfiles/file-manager';
export type {
  SabFileEntity as FileEntity,
  SabFileUploadItem as FileUploadItem,
  SabFileCardItem as FileCardItem,
} from '@/components/sabfiles/file-manager';

export type {
  SabStatisticsCard1Item as StatisticsCard1Item,
  SabActionSearchAction as LegacyActionSearchAction,
  SabFullscreenCalendarEvent as LegacyFullscreenCalendarEvent,
  SabTagPickerTag as LegacyTagPickerTag,
  SabChartTooltipProps as LegacyChartTooltipProps,
  SabToastProps as LegacyToastProps,
  SabToastActionElement as LegacyToastActionElement,
  SabToastInput as LegacyToastInput,
} from './composites';
