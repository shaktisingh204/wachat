/**
 * StPortalPopover — legacy twenty/ entry point.
 *
 * The implementation moved to the 20ui design system
 * (`src/components/sabcrm/20ui/portal-popover.tsx`) so 20ui has zero imports
 * from this legacy kit. This file stays as a thin re-export so the remaining
 * twenty-kit internals (`st-select.tsx`, `notifications-bell.tsx`) and any
 * legacy pages keep compiling against ONE shared implementation; it dies with
 * the rest of the twenty/ kit.
 *
 * NB: this deep import of a single 20ui file is safe — the barrel self-cycle
 * rule only forbids importing the 20ui ROOT barrel (`@/components/sabcrm/20ui`)
 * from inside the barrel tree, and this file is outside that tree anyway.
 */
export {
  StPortalPopover,
  type StPopoverPlacement,
  type StPopoverAlign,
  type StPortalPopoverProps,
} from '@/components/sabcrm/20ui/portal-popover';
export { default } from '@/components/sabcrm/20ui/portal-popover';
