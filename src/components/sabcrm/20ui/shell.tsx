'use client';

/**
 * 20ui — Shell (app layout chrome).
 *
 * Composable dashboard frame, generic (no app-specific routes baked in):
 *
 *   [AppRail]  ·  [AppSidebar]  ·  ( AppHeader / AppMain )
 *
 * Exports:
 *   - AppShell    the grid container (rail | sidebar | header-over-main).
 *   - AppRail     a thin left icon strip (brand + items + footer items).
 *   - AppSidebar  a module nav column (heading, caption, collapsible groups).
 *   - AppHeader   the top bar — slot based (leading / center / trailing).
 *   - AppMain     the scrollable content region (contained | full-bleed).
 *   - HomeShell   a convenience that assembles all of the above from props.
 *
 * Behaviour:
 *   - Responsive: under the `md` breakpoint (768px) the sidebar collapses to
 *     an overlay drawer toggled from the header hamburger (provided by the
 *     shell context); a scrim dismisses it and Escape closes it.
 *   - Keyboard reachable: a skip link is the first tab stop, every control is a
 *     native <button>/<a>, collapsible groups expose aria-expanded, the drawer
 *     restores focus to its trigger on close.
 *
 * Emil motion: transform/opacity only on the shared ease-out, <250ms; the
 * shell.css `prefers-reduced-motion` block disables every movement.
 */

import * as React from 'react';
import { Menu as MenuIcon, ChevronDown } from 'lucide-react';

import { Tooltip } from './tooltip';
import { IconButton } from './button';
import { renderIcon, type IconProp } from './_icon';
import './shell.css';

/* ------------------------------------------------------------------------ *
 * Shell context — lets AppHeader's hamburger drive the AppSidebar drawer
 * without prop-drilling through the consumer's layout tree.
 * ------------------------------------------------------------------------ */

interface ShellContextValue {
  /** Whether the small-screen sidebar drawer is open. */
  drawerOpen: boolean;
  /** Toggle / set the drawer (no-op when there is no collapsible sidebar). */
  setDrawerOpen: (open: boolean) => void;
  /** True when a sidebar exists and may be toggled on small screens. */
  hasSidebar: boolean;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

function useShellContext(): ShellContextValue {
  return (
    React.useContext(ShellContext) ?? {
      drawerOpen: false,
      setDrawerOpen: () => {},
      hasSidebar: false,
    }
  );
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ======================================================================== *
 * AppShell — the grid container
 * ======================================================================== */

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Set when the shell has NO rail so the small-screen drawer can hug the
   * viewport edge. Purely a styling hint; defaults to false.
   */
  noRail?: boolean;
}

/**
 * The grid frame. Compose children directly:
 *
 *   <AppShell>
 *     <AppRail … />
 *     <AppSidebar … />
 *     <AppShellColumn>
 *       <AppHeader … />
 *       <AppMain>…</AppMain>
 *     </AppShellColumn>
 *   </AppShell>
 *
 * Provides the drawer context that wires AppHeader's hamburger to AppSidebar.
 */
export function AppShell({
  noRail = false,
  className,
  children,
  ...rest
}: AppShellProps): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [hasSidebar, setHasSidebar] = React.useState(false);

  // AppSidebar registers itself on mount so the header hamburger only shows
  // when a collapsible sidebar is actually present.
  const registerSidebar = React.useCallback((present: boolean) => {
    setHasSidebar(present);
  }, []);

  const ctx = React.useMemo<ShellContextValue & { registerSidebar: (p: boolean) => void }>(
    () => ({ drawerOpen, setDrawerOpen, hasSidebar, registerSidebar }),
    [drawerOpen, hasSidebar, registerSidebar],
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className={cx('u-shell', noRail && 'u-shell--no-rail', className)} {...rest}>
        <a className="u-shell__skip" href="#u-main-content">
          Skip to content
        </a>
        {children}
      </div>
    </ShellContext.Provider>
  );
}

/**
 * The header-over-main column (occupies the last grid track). Wrap AppHeader +
 * AppMain in this so they stack vertically inside the shell grid.
 */
export function AppShellColumn({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cx('u-shell__column', className)} {...rest}>
      {children}
    </div>
  );
}

/* ======================================================================== *
 * AppRail — thin vertical icon strip
 * ======================================================================== */

export interface AppRailItem {
  id: string;
  /** Accessible name (shown as a tooltip + used for aria-label). */
  label: string;
  icon: IconProp;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  /** Small count chip on the tile (e.g. unread). */
  badge?: React.ReactNode;
}

export interface AppRailProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Brand mark rendered at the top. */
  brand?: React.ReactNode;
  /** Primary navigation items. */
  items: AppRailItem[];
  /** Secondary items pinned to the bottom (settings, profile, etc.). */
  footer?: AppRailItem[];
  /** Accessible name for the rail landmark. */
  label?: string;
}

function RailButton({ item }: { item: AppRailItem }): React.JSX.Element {
  const cls = cx('u-rail__item', item.active && 'is-active');
  const inner = (
    <>
      {renderIcon(item.icon, { 'aria-hidden': 'true' })}
      {item.badge != null ? (
        <span className="u-rail__badge" aria-hidden="true">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  const control = item.href ? (
    <a
      className={cls}
      href={item.href}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      onClick={item.onClick}
    >
      {inner}
    </a>
  ) : (
    <button
      type="button"
      className={cls}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      onClick={item.onClick}
    >
      {inner}
    </button>
  );

  // Tooltip wraps a single focusable child; placement 'top' is the only
  // horizontal-safe option this primitive exposes.
  return (
    <Tooltip label={item.label} placement="top" openDelay={200}>
      {control}
    </Tooltip>
  );
}

/** A thin 56px icon rail. Pass your own items; routes are never baked in. */
export function AppRail({
  brand,
  items,
  footer,
  label = 'App navigation',
  className,
  ...rest
}: AppRailProps): React.JSX.Element {
  return (
    <aside className={cx('u-rail', className)} aria-label={label} {...rest}>
      {brand ? <div className="u-rail__brand">{brand}</div> : null}
      <nav className="u-rail__nav" aria-label="Primary">
        {items.map((item) => (
          <RailButton key={item.id} item={item} />
        ))}
      </nav>
      {footer && footer.length > 0 ? (
        <nav className="u-rail__footer" aria-label="Secondary">
          {footer.map((item) => (
            <RailButton key={item.id} item={item} />
          ))}
        </nav>
      ) : null}
    </aside>
  );
}

/* ======================================================================== *
 * AppSidebar — module nav column (collapsible groups + small-screen drawer)
 * ======================================================================== */

export interface SidebarLeaf {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  icon?: IconProp;
  badge?: React.ReactNode;
  onClick?: () => void;
  /** Nested children render a collapsible sub-tree. */
  children?: SidebarLeaf[];
  /** Initial open state for an item that has children. */
  defaultOpen?: boolean;
}

export interface SidebarGroup {
  id: string;
  /** Optional collapsible section heading. When absent the group is static. */
  label?: string;
  defaultOpen?: boolean;
  items: SidebarLeaf[];
}

export interface AppSidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Section heading at the top — usually the current module name. */
  heading?: React.ReactNode;
  /** Caption under the heading. */
  caption?: React.ReactNode;
  /** Grouped nav items. */
  groups: SidebarGroup[];
  /** Footer slot (plan card, upgrade CTA, etc.). */
  footer?: React.ReactNode;
}

/** A height-animated collapsible region used by groups and nested leaves. */
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | 'auto'>(open ? 'auto' : 0);
  // Skip the entrance transition on the very first paint so initially-open
  // groups do not animate from 0 on mount.
  const firstRun = React.useRef(true);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (firstRun.current) {
      firstRun.current = false;
      setHeight(open ? 'auto' : 0);
      return;
    }

    if (open) {
      // 0/closed -> measured -> auto (so it can reflow afterwards).
      setHeight(el.scrollHeight);
      const id = window.setTimeout(() => setHeight('auto'), 200);
      return () => window.clearTimeout(id);
    }
    // auto -> measured (forces a layout) -> 0 on the next frame.
    setHeight(el.scrollHeight);
    const raf = window.requestAnimationFrame(() => setHeight(0));
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div
      ref={ref}
      className="u-sidebar__collapse"
      hidden={!open && height === 0}
      style={{ height: height === 'auto' ? 'auto' : `${height}px` }}
    >
      {children}
    </div>
  );
}

function SidebarLeafRow({
  item,
  depth = 0,
}: {
  item: SidebarLeaf;
  depth?: number;
}): React.JSX.Element {
  const hasChildren = !!(item.children && item.children.length > 0);
  const childActive = hasChildren && item.children!.some((c) => c.active);
  const [open, setOpen] = React.useState(
    item.defaultOpen ?? item.active ?? childActive ?? false,
  );

  const cls = cx(
    'u-sidebar__leaf',
    depth > 0 && 'u-sidebar__leaf--child',
    item.active && 'is-active',
  );

  const body = (
    <>
      {renderIcon(item.icon, { 'aria-hidden': 'true' })}
      <span className="u-sidebar__leaf-label">{item.label}</span>
      {item.badge != null ? (
        <span className="u-sidebar__leaf-badge">{item.badge}</span>
      ) : null}
      {hasChildren ? <ChevronDown className="u-sidebar__leaf-chevron" aria-hidden="true" /> : null}
    </>
  );

  if (hasChildren) {
    return (
      <>
        <button
          type="button"
          className={cls}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {body}
        </button>
        <Collapse open={open}>
          <div className="u-sidebar__items">
            {item.children!.map((child) => (
              <SidebarLeafRow key={child.id} item={child} depth={depth + 1} />
            ))}
          </div>
        </Collapse>
      </>
    );
  }

  if (item.href) {
    return (
      <a
        className={cls}
        href={item.href}
        aria-current={item.active ? 'page' : undefined}
        onClick={item.onClick}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      aria-current={item.active ? 'page' : undefined}
      onClick={item.onClick}
    >
      {body}
    </button>
  );
}

function SidebarGroupBlock({ group }: { group: SidebarGroup }): React.JSX.Element {
  const [open, setOpen] = React.useState(group.defaultOpen ?? true);

  if (!group.label) {
    return (
      <div className="u-sidebar__group-static">
        <div className="u-sidebar__items">
          {group.items.map((item) => (
            <SidebarLeafRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="u-sidebar__group">
      <button
        type="button"
        className="u-sidebar__group-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{group.label}</span>
        <ChevronDown className="u-sidebar__group-chevron" aria-hidden="true" />
      </button>
      <Collapse open={open}>
        <div className="u-sidebar__items">
          {group.items.map((item) => (
            <SidebarLeafRow key={item.id} item={item} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * The module nav column. On small screens it becomes an overlay drawer driven
 * by the shell context (toggled from AppHeader's hamburger); a scrim and the
 * Escape key dismiss it, and focus returns to the trigger on close.
 */
export function AppSidebar({
  heading,
  caption,
  groups,
  footer,
  className,
  ...rest
}: AppSidebarProps): React.JSX.Element {
  const shell = React.useContext(ShellContext) as
    | (ShellContextValue & { registerSidebar?: (p: boolean) => void })
    | null;

  // Register presence so the header hamburger appears (and clean up on unmount).
  React.useEffect(() => {
    shell?.registerSidebar?.(true);
    return () => shell?.registerSidebar?.(false);
    // shell.registerSidebar is stable (useCallback); intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawerOpen = shell?.drawerOpen ?? false;
  const setDrawerOpen = shell?.setDrawerOpen;
  const asideRef = React.useRef<HTMLElement>(null);

  // Escape closes the drawer when it is open.
  React.useEffect(() => {
    if (!drawerOpen || !setDrawerOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  // Move focus into the drawer when it opens (a11y), so the next Tab lands on
  // a nav item rather than back at the page behind the scrim.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const raf = window.requestAnimationFrame(() => {
      const first = asideRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      first?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [drawerOpen]);

  return (
    <>
      <aside
        ref={asideRef}
        className={cx('u-sidebar', drawerOpen && 'is-open', className)}
        aria-label={typeof heading === 'string' ? heading : 'Module navigation'}
        {...rest}
      >
        {heading || caption ? (
          <div className="u-sidebar__head">
            {heading ? <p className="u-sidebar__heading">{heading}</p> : null}
            {caption ? <p className="u-sidebar__caption">{caption}</p> : null}
          </div>
        ) : null}
        <nav className="u-sidebar__nav">
          {groups.map((group) => (
            <SidebarGroupBlock key={group.id} group={group} />
          ))}
        </nav>
        {footer ? <div className="u-sidebar__footer">{footer}</div> : null}
      </aside>
      {drawerOpen && setDrawerOpen ? (
        <button
          type="button"
          className="u-shell__scrim"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
    </>
  );
}

/* ======================================================================== *
 * AppHeader — top bar (slot based)
 * ======================================================================== */

export interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Left slot — breadcrumb / page title. */
  leading?: React.ReactNode;
  /** Center slot — usually a global search input. */
  center?: React.ReactNode;
  /** Right slot — actions, notifications, profile menu. */
  trailing?: React.ReactNode;
  /** Stick to the top of the scroll container. Defaults to true. */
  sticky?: boolean;
  /**
   * Hide the small-screen hamburger even when a sidebar is present.
   * Defaults to false (hamburger shown on small screens when a sidebar exists).
   */
  hideMenuButton?: boolean;
}

/** The 56px top bar with three composable slots + a responsive menu button. */
export function AppHeader({
  leading,
  center,
  trailing,
  sticky = true,
  hideMenuButton = false,
  className,
  ...rest
}: AppHeaderProps): React.JSX.Element {
  const { drawerOpen, setDrawerOpen, hasSidebar } = useShellContext();
  const showMenu = hasSidebar && !hideMenuButton;

  return (
    <header className={cx('u-header', sticky && 'u-header--sticky', className)} {...rest}>
      {showMenu ? (
        <IconButton
          className="u-header__menu-btn"
          label={drawerOpen ? 'Close navigation' : 'Open navigation'}
          icon={MenuIcon}
          size="sm"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(!drawerOpen)}
        />
      ) : null}
      {leading ? <div className="u-header__slot">{leading}</div> : null}
      {center ? <div className="u-header__center">{center}</div> : null}
      {trailing ? (
        <div className="u-header__slot u-header__trailing">{trailing}</div>
      ) : null}
    </header>
  );
}

/* ======================================================================== *
 * AppMain — scrollable content region
 * ======================================================================== */

export interface AppMainProps extends React.HTMLAttributes<HTMLElement> {
  /** Constrain the content to a centred max-width column. */
  contained?: boolean;
  /** Edge-to-edge: drop the padding + max-width (for canvas-style pages). */
  bleed?: boolean;
}

/** The scrollable content region. Carries the skip-link target id. */
export function AppMain({
  contained = false,
  bleed = false,
  className,
  children,
  id = 'u-main-content',
  ...rest
}: AppMainProps): React.JSX.Element {
  return (
    <main
      id={id}
      tabIndex={-1}
      className={cx(
        'u-main',
        contained && !bleed && 'u-main--contained',
        bleed && 'u-main--bleed',
        className,
      )}
      {...rest}
    >
      {contained && !bleed ? <div className="u-main__inner">{children}</div> : children}
    </main>
  );
}

/* ======================================================================== *
 * HomeShell — convenience that assembles the whole frame from props
 * ======================================================================== */

export interface HomeShellProps {
  /** Rail config. When omitted, no rail is rendered. */
  rail?: {
    brand?: React.ReactNode;
    items: AppRailItem[];
    footer?: AppRailItem[];
    label?: string;
  };
  /** Sidebar config. When omitted, no sidebar column is rendered. */
  sidebar?: {
    heading?: React.ReactNode;
    caption?: React.ReactNode;
    groups: SidebarGroup[];
    footer?: React.ReactNode;
  };
  /** Header slots. */
  header?: {
    leading?: React.ReactNode;
    center?: React.ReactNode;
    trailing?: React.ReactNode;
    sticky?: boolean;
  };
  /** Constrain main to a centred column. */
  contained?: boolean;
  /** Edge-to-edge main (drops padding + max-width). */
  bleed?: boolean;
  /** Extra class on the AppShell root. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Assembles AppRail + AppSidebar + AppHeader + AppMain from a single props
 * object — the fastest way to stand up a full dashboard. Drop any of `rail`,
 * `sidebar`, or `header` to omit that piece.
 */
export function HomeShell({
  rail,
  sidebar,
  header,
  contained = false,
  bleed = false,
  className,
  children,
}: HomeShellProps): React.JSX.Element {
  return (
    <AppShell noRail={!rail} className={className}>
      {rail ? (
        <AppRail
          brand={rail.brand}
          items={rail.items}
          footer={rail.footer}
          label={rail.label}
        />
      ) : null}
      {sidebar ? (
        <AppSidebar
          heading={sidebar.heading}
          caption={sidebar.caption}
          groups={sidebar.groups}
          footer={sidebar.footer}
        />
      ) : null}
      <AppShellColumn>
        {header ? (
          <AppHeader
            leading={header.leading}
            center={header.center}
            trailing={header.trailing}
            sticky={header.sticky}
          />
        ) : null}
        <AppMain contained={contained} bleed={bleed}>
          {children}
        </AppMain>
      </AppShellColumn>
    </AppShell>
  );
}

export default AppShell;
