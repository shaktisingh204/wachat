/**
 * Clay — SabNode design system.
 *
 * A cream-canvas, dusty-rose, obsidian-CTA design language matched
 * pixel-for-pixel to the product reference (Rounds/Interview dashboard).
 * Every primitive in this barrel consumes the `--clay-*` CSS tokens
 * and Tailwind colors defined in `globals.css` and `tailwind.config.ts`.
 *
 * Usage:
 *   import { ClayShell, ClaySidebar, ClayCard, ClayButton } from '@/components/clay';
 */

export { ClayShell } from './clay-shell';
export { ClaySidebar } from './clay-sidebar';
export type { ClayNavItem, ClayNavGroup, ClaySidebarProps } from './clay-sidebar';
export { ClayTopbar } from './clay-topbar';
export type { ClayTopbarProps } from './clay-topbar';
export { ClayCard } from './clay-card';
export type { ClayCardProps } from './clay-card';
export { ClayButton } from './clay-button';
export type { ClayButtonProps } from './clay-button';
export { ClayBadge } from './clay-badge';
export type { ClayBadgeProps } from './clay-badge';
export { ClayBreadcrumbs } from './clay-breadcrumbs';
export type { ClayBreadcrumbItem, ClayBreadcrumbsProps } from './clay-breadcrumbs';
export { ClayAvatarStack } from './clay-avatar-stack';
export type { ClayAvatarStackItem, ClayAvatarStackProps } from './clay-avatar-stack';
export { ClayRoundCard } from './clay-round-card';
export type { ClayRoundCardProps, RoundStatus } from './clay-round-card';
export { ClayPromoCard } from './clay-promo-card';
export type { ClayPromoCardProps } from './clay-promo-card';
export { ClayListRow } from './clay-list-row';
export type { ClayListRowProps } from './clay-list-row';
export { ClayInput, ClaySelect } from './clay-input';
export type { ClayInputProps, ClaySelectProps } from './clay-input';
export { ClayNotificationCard } from './clay-notification-card';
export type { ClayNotificationCardProps } from './clay-notification-card';
export { ClaySectionHeader } from './clay-section-header';
export type { ClaySectionHeaderProps } from './clay-section-header';
export { ClaySectionList } from './clay-section-list';
export type { ClaySectionListItem, ClaySectionListProps } from './clay-section-list';
export { ClayUserCard } from './clay-user-card';
export type { ClayUserCardProps } from './clay-user-card';
export { ClayDashboardLayout } from './clay-dashboard-layout';
export type {
  ClayDashboardLayoutProps,
  ClayLayoutUser,
  ClayLayoutPlan,
  ClayLayoutContext,
} from './clay-dashboard-layout';
export { DashboardChromeDispatcher } from './dashboard-chrome-dispatcher';
export { ClayProjectGate } from './clay-project-gate';
export { ClayModuleTile } from './clay-module-tile';
export type { ClayModuleTileProps } from './clay-module-tile';
