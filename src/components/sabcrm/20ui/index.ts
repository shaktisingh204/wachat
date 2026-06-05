/**
 * 20ui — SabNode's standalone design system. Barrel export.
 *
 * Import the whole system from one place:
 *   import { Button, Card, Badge, Field, Input, Switch, Tabs, Modal } from '@/components/sabcrm/20ui';
 *
 * 20ui is app-wide: wrap any subtree in `<div className="ui20">` and every
 * component renders with its own self-contained tokens (light by default, add
 * `.dark` for dark mode) — no dependency on the CRM `.sabcrm-twenty` scope. The
 * token foundation (`src/styles/ui20.css`) is imported here so it loads wherever
 * 20ui is used; each component also ships its own styles.
 */
import '@/styles/ui20.css';

export * from './button';
export * from './card';
export * from './badge';
export * from './field';
export * from './choice';
export * from './select';
export * from './segmented';
export * from './tabs';
export * from './feedback';
export * from './loading';
export * from './tooltip';
export * from './menu';
export * from './pagination';
export * from './modal';
export * from './misc';
export * from './avatar';
export * from './premium';
export * from './table';
export * from './combobox';
export * from './popover';
export * from './form';
export * from './slider';
export * from './disclosure';
export * from './drawer';
export * from './toast';
export * from './command';
export * from './datepicker';
export * from './extras';
