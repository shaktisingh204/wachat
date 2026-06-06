/**
 * 20ui — SabNode's standalone design system. Barrel export.
 *
 * Import the whole system from one place:
 *   import { Button, Card, Badge, Field, Input, Switch, Tabs, Modal } from '@/components/sabcrm/20ui';
 *
 * 20ui is app-wide: wrap any subtree in `<div className="ui20">` and every
 * component renders with its own self-contained tokens (light by default, add
 * `.dark` for dark mode) — no dependency on the CRM `.sabcrm-twenty` scope. The
 * token foundation (`./tokens.css`) is imported here so it loads wherever
 * 20ui is used; each component also ships its own styles.
 */
import './tokens.css';

// Shared classname helper, re-exported so migrated files can import `cn` from
// the 20ui system (ZoruUI re-exported the same util).
export { cn } from '@/lib/utils';

export * from './button';
export * from './card';
export * from './badge';
export * from './field';
export * from './label';
export * from './choice';
// Select: the compound (Radix) API is canonical; the older props-based widget
// is kept as SelectField.
export { Select as SelectField, MultiSelect, type SelectOption, type SelectSize, type SelectProps, type MultiSelectProps } from './select';
export * from './select-radix';
export * from './segmented';
// Tabs: compound (Radix) API canonical; the props-based variant is TabsBar.
export { Tabs as TabsBar, TabPanel, type TabItem, type TabsProps, type TabPanelProps } from './tabs';
export * from './tabs-radix';
export * from './feedback';
export * from './loading';
// Tooltip: compound (Radix) API canonical; the single-child variant is SimpleTooltip.
export { Tooltip as SimpleTooltip, type TooltipPlacement, type TooltipProps } from './tooltip';
export * from './tooltip-radix';
export * from './menu';
export * from './pagination';
export * from './modal';
export * from './dialog';
export * from './breadcrumb';
export * from './progress';
export * from './misc';
export * from './avatar';
export * from './premium';
export * from './table';
export * from './combobox';
export * from './popover';
export * from './resizable';
export * from './form';
export * from './slider';
export * from './disclosure';
export * from './drawer';
export * from './toast';
export * from './command';
export * from './datepicker';
export * from './extras';
export * from './colorpicker';
export * from './carousel';
export * from './alertdialog';
export * from './sheet';
export * from './menubar';
export * from './scrollarea';
export * from './dropdown';
export * from './iconpicker';
export * from './daterange';
export * from './sidebar';
export * from './dock';
export * from './tagpicker';
export * from './actionsearchbar';
export * from './userdropdown';
export * from './notificationpopover';
export * from './tablewithdialog';
export * from './fullscreencalendar';
export * from './pageheader';
export * from './shell';
export * from './chart';
export * from './marketing';
export * from './pricing';
export * from './blocks';
export * from './loaders';
// Clean-named surface for the relocated legacy components (impls in ./legacy).
export * from './legacy-public';
