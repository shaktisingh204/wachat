'use client';

/**
 * 20ui — Menu (dropdown).
 *
 * A trigger-anchored command menu built on `StPortalPopover` (so it escapes any
 * clipping ancestor and scale-ins from its anchored edge for free). Full keyboard
 * model: Arrow up/down move between items, Home/End jump to the ends, Escape and
 * outside-click close, Enter/Space activate. Focus moves into the menu on open
 * and returns to the trigger on close. Items expose a danger variant, an optional
 * leading icon, and a trailing hint (e.g. a shortcut). ARIA: trigger is a
 * `button` with `aria-haspopup="menu"` + `aria-expanded`; the panel is
 * `role="menu"`; items are `role="menuitem"`.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { StPortalPopover, type StPopoverAlign } from './portal-popover';

import { renderIcon, type IconProp } from './_icon';
import './menu.css';

interface MenuContextValue {
  /** Register an item's ref so the menu can drive roving focus. */
  register: (el: HTMLButtonElement | null) => () => void;
  /** Close the menu and restore focus to the trigger. */
  close: () => void;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);

export interface MenuProps {
  /** The clickable element that opens the menu. Receives the toggle wiring. */
  trigger: React.ReactNode;
  /** Horizontal edge of the trigger the panel aligns to. */
  align?: StPopoverAlign;
  /** Accessible name for the menu panel (falls back to "Menu"). */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A dropdown menu. Wrap a trigger node and a set of `MenuItem`s:
 *
 *   <Menu trigger={<Button iconRight={ChevronDown}>Actions</Button>}>
 *     <MenuLabel>Record</MenuLabel>
 *     <MenuItem icon={Pencil} onSelect={edit}>Edit</MenuItem>
 *     <MenuSeparator />
 *     <MenuItem icon={Trash2} danger onSelect={remove}>Delete</MenuItem>
 *   </Menu>
 */
export function Menu({
  trigger,
  align = 'start',
  label = 'Menu',
  className,
  children,
}: MenuProps): React.JSX.Element {
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemsRef = React.useRef<HTMLButtonElement[]>([]);
  const [open, setOpen] = React.useState(false);

  const register = React.useCallback((el: HTMLButtonElement | null) => {
    if (!el) return () => {};
    itemsRef.current.push(el);
    return () => {
      itemsRef.current = itemsRef.current.filter((i) => i !== el);
    };
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    // Return focus to the trigger so keyboard users keep their place.
    const focusable = anchorRef.current?.querySelector<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  // Enabled items only, in DOM order — the targets for roving focus.
  const enabledItems = React.useCallback(
    () =>
      itemsRef.current
        .filter((el) => listRef.current?.contains(el) && !el.hasAttribute('aria-disabled'))
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        ),
    [],
  );

  const focusAt = React.useCallback(
    (index: number) => {
      const items = enabledItems();
      if (items.length === 0) return;
      const i = (index + items.length) % items.length;
      items[i]?.focus();
    },
    [enabledItems],
  );

  // On open, move focus to the first item once the panel has painted.
  React.useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => focusAt(0));
    return () => window.cancelAnimationFrame(raf);
  }, [open, focusAt]);

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = enabledItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(current < 0 ? 0 : current + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(current < 0 ? items.length - 1 : current - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'Tab':
        // Menus trap Tab: close so the page tab order resumes from the trigger.
        close();
        break;
      default:
        break;
    }
  };

  const ctx = React.useMemo<MenuContextValue>(() => ({ register, close }), [register, close]);

  return (
    <>
      <div
        ref={anchorRef}
        className="u-menu__anchor"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        // The trigger node carries the real button + ARIA; this wrapper only
        // captures the toggle. aria-haspopup/expanded are mirrored onto it so AT
        // announces the menu relationship even when the child is a plain node.
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>
      <StPortalPopover
        anchorRef={anchorRef}
        open={open}
        onClose={close}
        align={align}
        role="menu"
        ariaLabel={label}
        className={['u-menu', className].filter(Boolean).join(' ')}
      >
        <MenuContext.Provider value={ctx}>
          <div
            ref={listRef}
            className="u-menu__list"
            role="presentation"
            onKeyDown={onListKeyDown}
          >
            {children}
          </div>
        </MenuContext.Provider>
      </StPortalPopover>
    </>
  );
}

export interface MenuItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  /** Leading icon. */
  icon?: IconProp;
  /** Fired on click / Enter / Space. The menu closes afterwards. */
  onSelect: () => void;
  disabled?: boolean;
  /** Destructive action — renders in the danger colour. */
  danger?: boolean;
  /** Trailing hint, e.g. a keyboard shortcut. */
  hint?: React.ReactNode;
}

/** A single selectable row inside a `Menu`. */
export function MenuItem({
  icon,
  onSelect,
  disabled = false,
  danger = false,
  hint,
  className,
  children,
  ...rest
}: MenuItemProps): React.JSX.Element {
  const menu = React.useContext(MenuContext);
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => menu?.register(ref.current ?? null), [menu]);

  const activate = (): void => {
    if (disabled) return;
    onSelect();
    menu?.close();
  };

  const cls = ['u-menu__item', danger && 'u-menu__item--danger', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      className={cls}
      // Items are not in the page tab order; the menu drives roving focus.
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      {...rest}
    >
      {renderIcon(icon, { size: 15, className: 'u-menu__item-icon', 'aria-hidden': true })}
      <span className="u-menu__item-label">{children}</span>
      {hint != null ? <span className="u-menu__item-hint">{hint}</span> : null}
    </button>
  );
}

/** A hairline divider between groups of items. */
export function MenuSeparator({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      role="separator"
      className={['u-menu__sep', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}

/** A small, non-interactive section heading. */
export function MenuLabel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      role="presentation"
      className={['u-menu__group-label', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Menu;
