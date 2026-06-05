'use client';

/**
 * 20ui — Menubar.
 *
 * A macOS-style application menu bar: a horizontal strip of triggers, each
 * opening a token-skinned dropdown of items, checkboxes, radios, and nested
 * submenus. A thin wrapper around `@radix-ui/react-menubar` — Radix owns the
 * hard parts (roving focus between menus, type-ahead, arrow-key navigation,
 * outside-click + Escape dismissal, collision-aware positioning, and the full
 * `role="menubar"` / `role="menuitem*"` ARIA wiring); 20ui supplies the look:
 * a surface panel on `--u-elev-3`, items with a calm hover/active wash, an
 * accent check/dot indicator, and a right-aligned shortcut hint.
 *
 * Both portalled content roots (the menu panel and each submenu panel) carry
 * `className="ui20 sabcrm-twenty"` so the `--st-*` / `--u-*` tokens resolve no
 * matter where in the app the bar lives (panels render to `document.body`,
 * outside the CRM subtree). The Emil scale-in grows from the Radix-anchored
 * edge via `--radix-menubar-content-transform-origin`.
 *
 *   <Menubar>
 *     <MenubarMenu>
 *       <MenubarTrigger>File</MenubarTrigger>
 *       <MenubarContent>
 *         <MenubarItem>
 *           New file <MenubarShortcut>Cmd N</MenubarShortcut>
 *         </MenubarItem>
 *         <MenubarSeparator />
 *         <MenubarCheckboxItem checked>Show sidebar</MenubarCheckboxItem>
 *         <MenubarSub>
 *           <MenubarSubTrigger>Share</MenubarSubTrigger>
 *           <MenubarSubContent>
 *             <MenubarItem>Copy link</MenubarItem>
 *           </MenubarSubContent>
 *         </MenubarSub>
 *       </MenubarContent>
 *     </MenubarMenu>
 *   </Menubar>
 */

import * as React from 'react';
import * as RadixMenubar from '@radix-ui/react-menubar';
import { Check, ChevronRight, Circle } from 'lucide-react';

import './menubar.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/* ----- Structural primitives (no DOM of their own to skin) ----- */

/** Holds the state of one menu within the bar (its trigger + content). */
export const MenubarMenu = RadixMenubar.Menu;

/** Groups related items for assistive tech (`role="group"`). */
export const MenubarGroup = RadixMenubar.Group;

/** Portals its children to `<body>`. Used internally by the content panels. */
export const MenubarPortal = RadixMenubar.Portal;

/** Wraps a nested submenu (its `SubTrigger` + `SubContent`). */
export const MenubarSub = RadixMenubar.Sub;

/** Single-select group of radio items; controlled via `value`/`onValueChange`. */
export const MenubarRadioGroup = RadixMenubar.RadioGroup;

/* ----- Root bar ----- */

/** The horizontal bar holding every `MenubarMenu`. Renders `role="menubar"`. */
export const Menubar = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Root>,
  React.ComponentPropsWithoutRef<typeof RadixMenubar.Root>
>(function Menubar({ className, ...rest }, ref) {
  return (
    <RadixMenubar.Root ref={ref} className={cx('u-menubar', className)} {...rest} />
  );
});

/* ----- Trigger ----- */

/** A top-level menu button. Highlights on `data-state="open"`. */
export const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixMenubar.Trigger>
>(function MenubarTrigger({ className, ...rest }, ref) {
  return (
    <RadixMenubar.Trigger
      ref={ref}
      className={cx('u-menubar__trigger', className)}
      {...rest}
    />
  );
});

/* ----- Content panel (portalled) ----- */

export interface MenubarContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenubar.Content> {
  /** Props forwarded to the underlying `Menubar.Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixMenubar.Portal>;
}

/**
 * The dropdown panel for a top-level menu. Portalled to `<body>`, skinned with
 * 20ui tokens, and animated with a `data-side`-aware scale-in.
 */
export const MenubarContent = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Content>,
  MenubarContentProps
>(function MenubarContent(
  { className, align = 'start', alignOffset = -4, sideOffset = 6, portalProps, ...rest },
  ref,
) {
  return (
    <RadixMenubar.Portal {...portalProps}>
      {/* Wrapper carries the system classes so tokens resolve in the body
          portal; it is layout-transparent (display: contents) so it never
          interferes with Radix's fixed positioning of the panel. */}
      <div className="ui20 sabcrm-twenty u-menubar__portal">
        <RadixMenubar.Content
          ref={ref}
          align={align}
          alignOffset={alignOffset}
          sideOffset={sideOffset}
          className={cx('u-menubar__content', className)}
          {...rest}
        />
      </div>
    </RadixMenubar.Portal>
  );
});

/* ----- Items ----- */

export interface MenubarItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenubar.Item> {
  /** Indent to align with checkbox/radio items that reserve an indicator slot. */
  inset?: boolean;
}

/** A standard, selectable command. */
export const MenubarItem = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Item>,
  MenubarItemProps
>(function MenubarItem({ className, inset, ...rest }, ref) {
  return (
    <RadixMenubar.Item
      ref={ref}
      className={cx('u-menubar__item', inset && 'u-menubar__item--inset', className)}
      {...rest}
    />
  );
});

/** A toggleable command; shows an accent check when `checked`. */
export const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RadixMenubar.CheckboxItem>
>(function MenubarCheckboxItem({ className, children, checked, ...rest }, ref) {
  return (
    <RadixMenubar.CheckboxItem
      ref={ref}
      checked={checked}
      className={cx('u-menubar__item', 'u-menubar__item--indicator', className)}
      {...rest}
    >
      <span className="u-menubar__indicator" aria-hidden="true">
        <RadixMenubar.ItemIndicator>
          <Check className="u-menubar__check" size={14} strokeWidth={2.5} />
        </RadixMenubar.ItemIndicator>
      </span>
      <span className="u-menubar__item-label">{children}</span>
    </RadixMenubar.CheckboxItem>
  );
});

/** A single-select option within a `MenubarRadioGroup`; shows an accent dot. */
export const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.RadioItem>,
  React.ComponentPropsWithoutRef<typeof RadixMenubar.RadioItem>
>(function MenubarRadioItem({ className, children, ...rest }, ref) {
  return (
    <RadixMenubar.RadioItem
      ref={ref}
      className={cx('u-menubar__item', 'u-menubar__item--indicator', className)}
      {...rest}
    >
      <span className="u-menubar__indicator" aria-hidden="true">
        <RadixMenubar.ItemIndicator>
          <Circle className="u-menubar__dot" size={6} fill="currentColor" />
        </RadixMenubar.ItemIndicator>
      </span>
      <span className="u-menubar__item-label">{children}</span>
    </RadixMenubar.RadioItem>
  );
});

/* ----- Label / Separator ----- */

export interface MenubarLabelProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenubar.Label> {
  /** Indent to align with checkbox/radio items. */
  inset?: boolean;
}

/** A non-interactive section heading inside a menu. */
export const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Label>,
  MenubarLabelProps
>(function MenubarLabel({ className, inset, ...rest }, ref) {
  return (
    <RadixMenubar.Label
      ref={ref}
      className={cx('u-menubar__label', inset && 'u-menubar__label--inset', className)}
      {...rest}
    />
  );
});

/** A 1px divider between item groups. */
export const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixMenubar.Separator>
>(function MenubarSeparator({ className, ...rest }, ref) {
  return (
    <RadixMenubar.Separator ref={ref} className={cx('u-menubar__sep', className)} {...rest} />
  );
});

/* ----- Shortcut hint ----- */

/**
 * Right-aligned keyboard-shortcut hint inside a menu item (e.g. "Cmd N").
 * Decorative — `aria-hidden` so screen readers do not read the glyphs as text.
 */
export function MenubarShortcut({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return <span className={cx('u-menubar__shortcut', className)} aria-hidden="true" {...rest} />;
}
MenubarShortcut.displayName = 'MenubarShortcut';

/* ----- Submenu (nested) ----- */

export interface MenubarSubTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenubar.SubTrigger> {
  /** Indent to align with checkbox/radio items. */
  inset?: boolean;
}

/** Opens a nested submenu; carries a trailing chevron. */
export const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.SubTrigger>,
  MenubarSubTriggerProps
>(function MenubarSubTrigger({ className, inset, children, ...rest }, ref) {
  return (
    <RadixMenubar.SubTrigger
      ref={ref}
      className={cx(
        'u-menubar__item',
        'u-menubar__subtrigger',
        inset && 'u-menubar__item--inset',
        className,
      )}
      {...rest}
    >
      <span className="u-menubar__item-label">{children}</span>
      <ChevronRight className="u-menubar__chevron" size={14} aria-hidden="true" />
    </RadixMenubar.SubTrigger>
  );
});

export interface MenubarSubContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenubar.SubContent> {
  /** Props forwarded to the underlying `Menubar.Portal`. */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixMenubar.Portal>;
}

/** The nested submenu panel. Portalled + skinned like the top-level content. */
export const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof RadixMenubar.SubContent>,
  MenubarSubContentProps
>(function MenubarSubContent({ className, sideOffset = 2, alignOffset = -4, portalProps, ...rest }, ref) {
  return (
    <RadixMenubar.Portal {...portalProps}>
      <div className="ui20 sabcrm-twenty u-menubar__portal">
        <RadixMenubar.SubContent
          ref={ref}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          className={cx('u-menubar__content', 'u-menubar__subcontent', className)}
          {...rest}
        />
      </div>
    </RadixMenubar.Portal>
  );
});

export default Menubar;
