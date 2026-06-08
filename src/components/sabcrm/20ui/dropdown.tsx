'use client';

/**
 * 20ui — DropdownMenu.
 *
 * A full, token-skinned wrapper around `@radix-ui/react-dropdown-menu` — richer
 * than the lightweight 20ui `Menu`: it adds checkbox items, radio groups,
 * sub-menus, labels, separators, shortcuts and a danger item variant on top of
 * Radix's accessible foundation (roving focus, typeahead, Escape + outside-click
 * dismissal, full `role="menu"` / `menuitem` / `menuitemcheckbox` / `menuitemradio`
 * wiring, and collision-aware positioning).
 *
 * 20ui supplies the look: a surface panel on `--u-elev-3`, the one accent for the
 * highlighted row, Check / Circle indicators, a ChevronRight on sub-triggers, and
 * an Emil scale-in that grows from whichever edge Radix anchored to (keyed off the
 * Radix `--radix-dropdown-menu-content-transform-origin` var, see dropdown.css).
 *
 * Content and SubContent each portal to `<body>` through a wrapper that carries
 * `className="20ui sabcrm-twenty"`, so the `--st-*` / `--u-*` tokens resolve no
 * matter where in the app the trigger lives.
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild>
 *       <Button variant="secondary" iconRight={ChevronDown}>Actions</Button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent align="start">
 *       <DropdownMenuLabel>Record</DropdownMenuLabel>
 *       <DropdownMenuItem iconLeft={Pencil}>Edit lead</DropdownMenuItem>
 *       <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
 *         Pin to top
 *       </DropdownMenuCheckboxItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem variant="danger" iconLeft={Trash2}>
 *         Delete lead
 *         <DropdownMenuShortcut>Del</DropdownMenuShortcut>
 *       </DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */

import * as React from 'react';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle, type LucideIcon } from 'lucide-react';

import './dropdown.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Root state holder. Controlled via `open`/`onOpenChange` or left uncontrolled. */
export const DropdownMenu = RadixDropdownMenu.Root;

/** The element that toggles the menu. Use `asChild` to keep your own button. */
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;

/** Groups related items together (wired with `role="group"`). */
export const DropdownMenuGroup = RadixDropdownMenu.Group;

/** Portal primitive — re-exported so callers can portal sub-content manually. */
export const DropdownMenuPortal = RadixDropdownMenu.Portal;

/** Sub-menu state holder (pairs `DropdownMenuSubTrigger` + `DropdownMenuSubContent`). */
export const DropdownMenuSub = RadixDropdownMenu.Sub;

/** A set of mutually-exclusive radio items; bind with `value` + `onValueChange`. */
export const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup;

/* ------------------------------------------------------------------ Content */

export interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content> {
  /** Props forwarded to the underlying `Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Portal>;
}

/**
 * The floating menu panel. Portalled to `<body>`, skinned with 20ui tokens, and
 * animated with a transform-origin-aware scale-in. Forwards its ref to the Radix
 * content node.
 */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Content>,
  DropdownMenuContentProps
>(function DropdownMenuContent(
  { className, portalProps, sideOffset = 6, collisionPadding = 8, ...rest },
  ref,
) {
  return (
    <RadixDropdownMenu.Portal {...portalProps}>
      {/* The wrapper carries the system classes so tokens resolve in the body
          portal; `display: contents` keeps it out of Radix's positioning. */}
      <div className="20ui sabcrm-twenty u-dropdown__portal">
        <RadixDropdownMenu.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx('u-dropdown', className)}
          {...rest}
        />
      </div>
    </RadixDropdownMenu.Portal>
  );
});

/* -------------------------------------------------------------------- Items */

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> {
  /** Reserve the indicator gutter so the row lines up with checkbox/radio items. */
  inset?: boolean;
  /** Style intent. `danger` paints the row in the danger accent. */
  variant?: 'default' | 'danger';
  /** Convenience leading icon (decorative; rendered `aria-hidden`). */
  iconLeft?: LucideIcon;
}

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem(
  { className, inset, variant = 'default', iconLeft: IconLeft, children, ...rest },
  ref,
) {
  return (
    <RadixDropdownMenu.Item
      ref={ref}
      className={cx(
        'u-dropdown__item',
        inset && 'u-dropdown__item--inset',
        variant === 'danger' && 'u-dropdown__item--danger',
        className,
      )}
      {...rest}
    >
      {IconLeft ? <IconLeft className="u-dropdown__item-icon" aria-hidden="true" /> : null}
      {children}
    </RadixDropdownMenu.Item>
  );
});

export interface DropdownMenuCheckboxItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem> {}

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(function DropdownMenuCheckboxItem({ className, children, checked, ...rest }, ref) {
  return (
    <RadixDropdownMenu.CheckboxItem
      ref={ref}
      checked={checked}
      className={cx('u-dropdown__item', 'u-dropdown__item--indicator', className)}
      {...rest}
    >
      <span className="u-dropdown__indicator" aria-hidden="true">
        <RadixDropdownMenu.ItemIndicator>
          <Check className="u-dropdown__indicator-check" />
        </RadixDropdownMenu.ItemIndicator>
      </span>
      {children}
    </RadixDropdownMenu.CheckboxItem>
  );
});

export interface DropdownMenuRadioItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.RadioItem> {}

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.RadioItem>,
  DropdownMenuRadioItemProps
>(function DropdownMenuRadioItem({ className, children, ...rest }, ref) {
  return (
    <RadixDropdownMenu.RadioItem
      ref={ref}
      className={cx('u-dropdown__item', 'u-dropdown__item--indicator', className)}
      {...rest}
    >
      <span className="u-dropdown__indicator" aria-hidden="true">
        <RadixDropdownMenu.ItemIndicator>
          <Circle className="u-dropdown__indicator-dot" />
        </RadixDropdownMenu.ItemIndicator>
      </span>
      {children}
    </RadixDropdownMenu.RadioItem>
  );
});

/* ----------------------------------------------------- Label / Separator */

export interface DropdownMenuLabelProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label> {
  /** Align with indicator rows by reserving the gutter. */
  inset?: boolean;
}

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Label>,
  DropdownMenuLabelProps
>(function DropdownMenuLabel({ className, inset, ...rest }, ref) {
  return (
    <RadixDropdownMenu.Label
      ref={ref}
      className={cx('u-dropdown__label', inset && 'u-dropdown__label--inset', className)}
      {...rest}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(function DropdownMenuSeparator({ className, ...rest }, ref) {
  return (
    <RadixDropdownMenu.Separator
      ref={ref}
      className={cx('u-dropdown__separator', className)}
      {...rest}
    />
  );
});

/**
 * Trailing keyboard hint (e.g. "Del", "Cmd N"). Decorative — `aria-hidden` so
 * screen readers do not announce the glyph alongside the item label.
 */
export function DropdownMenuShortcut({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return <span aria-hidden="true" className={cx('u-dropdown__shortcut', className)} {...rest} />;
}

/* ----------------------------------------------------------------- Sub-menu */

export interface DropdownMenuSubTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubTrigger> {
  inset?: boolean;
  iconLeft?: LucideIcon;
}

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubTrigger>,
  DropdownMenuSubTriggerProps
>(function DropdownMenuSubTrigger(
  { className, inset, iconLeft: IconLeft, children, ...rest },
  ref,
) {
  return (
    <RadixDropdownMenu.SubTrigger
      ref={ref}
      className={cx(
        'u-dropdown__item',
        'u-dropdown__subtrigger',
        inset && 'u-dropdown__item--inset',
        className,
      )}
      {...rest}
    >
      {IconLeft ? <IconLeft className="u-dropdown__item-icon" aria-hidden="true" /> : null}
      {children}
      <ChevronRight className="u-dropdown__subtrigger-chevron" aria-hidden="true" />
    </RadixDropdownMenu.SubTrigger>
  );
});

export interface DropdownMenuSubContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubContent> {
  /** Props forwarded to the underlying `Portal`. */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Portal>;
}

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubContent>,
  DropdownMenuSubContentProps
>(function DropdownMenuSubContent(
  { className, portalProps, sideOffset = 4, collisionPadding = 8, ...rest },
  ref,
) {
  return (
    <RadixDropdownMenu.Portal {...portalProps}>
      <div className="20ui sabcrm-twenty u-dropdown__portal">
        <RadixDropdownMenu.SubContent
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx('u-dropdown', 'u-dropdown--sub', className)}
          {...rest}
        />
      </div>
    </RadixDropdownMenu.Portal>
  );
});

export default DropdownMenu;
