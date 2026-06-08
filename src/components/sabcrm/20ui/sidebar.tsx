'use client';

/**
 * 20ui — Sidebar.
 *
 * A controllable, collapsible navigation rail. A single `SidebarProvider` owns
 * the expanded/collapsed state (controlled via `open`/`onOpenChange`, or left
 * uncontrolled with `defaultOpen`), and every part reads it through context.
 *
 * Layout: `SidebarHeader` (brand) · `SidebarContent` (scrolling groups + menus)
 * · `SidebarFooter` (pinned). When collapsed the rail shrinks to an icon strip;
 * labels fade out and each `SidebarMenuButton` reveals a right-side tooltip on
 * hover/focus so the destination stays discoverable.
 *
 * A11y: the rail is a `<nav>` with a label; the active item is marked with
 * `aria-current`; `SidebarTrigger` is a real `<button>` exposing
 * `aria-expanded` + `aria-controls`; the collapsed tooltip is a portalled
 * `role="tooltip"` linked to its button via `aria-describedby`. The whole rail
 * is keyboard-navigable because every control is a native element.
 *
 * Motion (Emil): width animates with the custom ease; labels/tooltips use
 * transform + opacity only; pressables scale on `:active`. The global
 * `prefers-reduced-motion` layer (plus a local block in sidebar.css) disables
 * movement.
 *
 *   <SidebarProvider defaultOpen>
 *     <Sidebar aria-label="Workspace">
 *       <SidebarHeader>Acme CRM</SidebarHeader>
 *       <SidebarContent>
 *         <SidebarGroup label="Workspace">
 *           <SidebarMenu>
 *             <SidebarMenuItem>
 *               <SidebarMenuButton icon={Home} isActive>Home</SidebarMenuButton>
 *             </SidebarMenuItem>
 *           </SidebarMenu>
 *         </SidebarGroup>
 *       </SidebarContent>
 *       <SidebarFooter>…</SidebarFooter>
 *     </Sidebar>
 *   </SidebarProvider>
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { PanelLeft, type LucideIcon } from 'lucide-react';

import { renderIcon, type IconProp } from './_icon';
import './sidebar.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- Context */

export interface SidebarContextValue {
  /** Whether the rail is expanded (true) or collapsed to an icon strip (false). */
  open: boolean;
  /** Set the open state directly. */
  setOpen: (open: boolean) => void;
  /** Flip the current open state. */
  toggle: () => void;
  /** Stable id for the rail, used to wire `aria-controls` on the trigger. */
  railId: string;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

/** Read the sidebar state. Must be called inside a `SidebarProvider`. */
export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (ctx === null) {
    throw new Error('useSidebar must be used within a <SidebarProvider>.');
  }
  return ctx;
}

export interface SidebarProviderProps {
  children: React.ReactNode;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Controlled open state. Pair with `onOpenChange`. */
  open?: boolean;
  /** Notified whenever the open state should change (controlled or not). */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Provides collapsible state to a sidebar subtree. Works controlled (`open` +
 * `onOpenChange`) or uncontrolled (`defaultOpen`). Persists nothing.
 */
export function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: SidebarProviderProps): React.JSX.Element {
  const railId = React.useId();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;

  // Keep the latest onOpenChange in a ref so `setOpen`/`toggle` stay stable
  // without dropping callback updates (avoids a stale-closure on the handler).
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [isControlled],
  );

  // `open` is read through a ref inside toggle so the callback can stay stable
  // across renders while still flipping the freshest value.
  const openRef = React.useRef(open);
  openRef.current = open;
  const toggle = React.useCallback(() => {
    setOpen(!openRef.current);
  }, [setOpen]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({ open, setOpen, toggle, railId }),
    [open, setOpen, toggle, railId],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/* -------------------------------------------------------------------- Rail */

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Accessible name for the navigation landmark. Defaults to "Sidebar". */
  'aria-label'?: string;
}

/**
 * The navigation rail itself — a `<nav>` landmark that grows/shrinks with the
 * provider's open state. Forwards its ref to the underlying element.
 */
export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  function Sidebar({ className, children, 'aria-label': ariaLabel = 'Sidebar', ...rest }, ref) {
    const { open, railId } = useSidebar();
    return (
      <nav
        ref={ref}
        id={railId}
        aria-label={ariaLabel}
        data-state={open ? 'expanded' : 'collapsed'}
        className={cx('u-sidebar', !open && 'u-sidebar--collapsed', className)}
        {...rest}
      >
        <div className="u-sidebar__inner">{children}</div>
      </nav>
    );
  },
);

/** Brand / logo region at the top of the rail. */
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarHeader({ className, ...rest }, ref) {
  return <div ref={ref} className={cx('u-sidebar__header', className)} {...rest} />;
});

/** Scrolling middle region that holds the menu groups. */
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarContent({ className, ...rest }, ref) {
  return <div ref={ref} className={cx('u-sidebar__content', className)} {...rest} />;
});

/** Pinned bottom region (user chip, settings, collapse control). */
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarFooter({ className, ...rest }, ref) {
  return <div ref={ref} className={cx('u-sidebar__footer', className)} {...rest} />;
});

/* ------------------------------------------------------------------- Group */

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional section heading shown above the items (hidden when collapsed). */
  label?: React.ReactNode;
}

/** A labelled section of the menu. The label is hidden in the collapsed rail. */
export const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  function SidebarGroup({ className, label, children, ...rest }, ref) {
    const labelId = React.useId();
    return (
      <div
        ref={ref}
        role="group"
        aria-labelledby={label != null ? labelId : undefined}
        className={cx('u-sidebar__group', className)}
        {...rest}
      >
        {label != null ? (
          <div id={labelId} className="u-sidebar__group-label" aria-hidden="true">
            {label}
          </div>
        ) : null}
        {children}
      </div>
    );
  },
);

/** The list element wrapping menu items (`<ul>`). */
export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(function SidebarMenu({ className, ...rest }, ref) {
  return <ul ref={ref} className={cx('u-sidebar__menu', className)} {...rest} />;
});

/** A single menu row (`<li>`). Wrap one `SidebarMenuButton`. */
export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(function SidebarMenuItem({ className, ...rest }, ref) {
  return <li ref={ref} className={cx('u-sidebar__item', className)} {...rest} />;
});

/* -------------------------------------------------------- Collapsed tooltip */

interface CollapsedTooltipProps {
  /** The bubble text (the menu label). */
  label: React.ReactNode;
  /** Whether the tooltip is currently visible. */
  open: boolean;
  /** Anchor rect in viewport coordinates (the button being hovered/focused). */
  rect: DOMRect | null;
  /** Stable id so the trigger can reference it via `aria-describedby`. */
  id: string;
}

/**
 * A portalled label bubble shown to the right of a collapsed menu button.
 * Lives on `document.body` under the system classes so tokens resolve, and is
 * positioned with fixed coordinates derived from the anchor rect.
 */
function CollapsedTooltip({ label, open, rect, id }: CollapsedTooltipProps): React.ReactNode {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || !open || rect === null) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: rect.top + rect.height / 2,
    left: rect.right + 8,
  };

  return createPortal(
    <div className="20ui sabcrm-twenty u-sidebar-tip__portal">
      <span id={id} role="tooltip" className="u-sidebar-tip" style={style}>
        {label}
      </span>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Button */

export interface SidebarMenuButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Leading icon (shown in both expanded and collapsed states). */
  icon?: IconProp;
  /** The visible label. Also used as the collapsed tooltip text. */
  children: React.ReactNode;
  /** Marks the current destination — sets `aria-current` + active styling. */
  isActive?: boolean;
  /**
   * Override the collapsed tooltip text. Defaults to `children` when it is a
   * plain string; supply this when `children` is rich content.
   */
  tooltip?: string;
  /**
   * Render the control as a custom element (e.g. a Next.js `<Link>`) instead of
   * the default `<button>`. Receives the composed className, the resolved
   * `aria-current`, and the inner icon+label content. When provided, the default
   * button + collapsed tooltip are bypassed (used by link-based navigation).
   */
  render?: (props: {
    className: string;
    'aria-current': 'page' | undefined;
    children: React.ReactNode;
  }) => React.ReactNode;
}

/**
 * One navigation control. Renders a native `<button>` with an icon + label;
 * when the rail is collapsed it shrinks to the icon and reveals a right-side
 * tooltip on hover/focus. Forwards its ref to the button.
 */
export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  function SidebarMenuButton(
    { icon, children, isActive = false, tooltip, render, className, type = 'button', onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest },
    ref,
  ) {
    const { open } = useSidebar();
    const localRef = React.useRef<HTMLButtonElement | null>(null);
    const tipId = React.useId();
    const [tipOpen, setTipOpen] = React.useState(false);
    const [rect, setRect] = React.useState<DOMRect | null>(null);

    // Only the collapsed rail shows tooltips; force-close when re-expanding so a
    // stray bubble can't linger after the layout changes underneath it.
    const tooltipEnabled = !open;
    React.useEffect(() => {
      if (open) setTipOpen(false);
    }, [open]);

    const mergeRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const showTip = React.useCallback(() => {
      if (!tooltipEnabled) return;
      const node = localRef.current;
      if (node) setRect(node.getBoundingClientRect());
      setTipOpen(true);
    }, [tooltipEnabled]);

    const hideTip = React.useCallback(() => setTipOpen(false), []);

    // Hide on Escape (keyboard users keep focus on the button).
    React.useEffect(() => {
      if (!tipOpen) return;
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') setTipOpen(false);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [tipOpen]);

    const tipText = tooltip ?? (typeof children === 'string' ? children : undefined);
    const showTooltip = tooltipEnabled && tipOpen && tipText != null;

    const describedBy =
      [rest['aria-describedby'], showTooltip ? tipId : null].filter(Boolean).join(' ') || undefined;

    const chain =
      (theirs: ((e: never) => void) | undefined, ours: () => void) =>
      (e: never): void => {
        theirs?.(e);
        ours();
      };

    const buttonCls = cx('u-sidebar__button', isActive && 'is-active', className);
    const inner = (
      <>
        {renderIcon(icon, { size: 16, className: 'u-sidebar__button-icon', 'aria-hidden': true })}
        <span className="u-sidebar__button-label">{children}</span>
      </>
    );

    // Custom render (e.g. a Next.js Link) bypasses the native button + the
    // collapsed tooltip (link nav is used in the always-expanded sidebar).
    if (render) {
      return <>{render({ className: buttonCls, 'aria-current': isActive ? 'page' : undefined, children: inner })}</>;
    }

    return (
      <>
        <button
          ref={mergeRef}
          type={type}
          aria-current={isActive ? 'page' : undefined}
          aria-describedby={describedBy}
          data-active={isActive ? '' : undefined}
          className={buttonCls}
          onMouseEnter={chain(onMouseEnter as undefined, showTip)}
          onMouseLeave={chain(onMouseLeave as undefined, hideTip)}
          onFocus={chain(onFocus as undefined, showTip)}
          onBlur={chain(onBlur as undefined, hideTip)}
          {...rest}
        >
          {inner}
        </button>
        {tipText != null ? (
          <CollapsedTooltip id={tipId} label={tipText} open={showTooltip} rect={rect} />
        ) : null}
      </>
    );
  },
);

/* ----------------------------------------------------------------- Trigger */

export interface SidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name for the icon-only control. Defaults to "Toggle sidebar". */
  label?: string;
  /** Custom toggle glyph; defaults to a PanelLeft icon. */
  icon?: IconProp;
}

/**
 * Toggles the rail open/closed. A native icon-only `<button>` wired with
 * `aria-expanded` + `aria-controls` pointing at the rail. Forwards its ref.
 */
export const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  function SidebarTrigger(
    { label = 'Toggle sidebar', icon = PanelLeft, className, onClick, type = 'button', ...rest },
    ref,
  ) {
    const { open, toggle, railId } = useSidebar();
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) toggle();
      },
      [onClick, toggle],
    );
    return (
      <button
        ref={ref}
        type={type}
        className={cx('u-sidebar__trigger', className)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={railId}
        onClick={handleClick}
        {...rest}
      >
        {renderIcon(icon, { size: 16, 'aria-hidden': true })}
      </button>
    );
  },
);

export default Sidebar;
