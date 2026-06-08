'use client';

/**
 * 20ui — Tabs (controlled) + TabPanel.
 *
 * A WAI-ARIA tablist: one `role=tablist` of `role=tab` buttons with a single
 * accent underline that slides under the active tab (transform only). Selection
 * is controlled (`value` + `onChange`). Keyboard: Arrow keys move between tabs
 * (with wrap), Home/End jump to the first/last, and roving `tabindex` keeps a
 * single tab in the tab order. Each tab points at its panel via `aria-controls`;
 * the `TabPanel` helper renders the matching `role=tabpanel`.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { renderIcon, type IconProp } from './_icon';
import './tabs.css';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Leading icon. */
  icon?: IconProp;
  /** Trailing count/status badge (e.g. a number). */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  /** The active tab value. */
  value: string;
  onChange: (value: string) => void;
  /** Stretch tabs to fill the row evenly. */
  fitted?: boolean;
  /** Compact density for dense toolbars/inspectors. */
  size?: 'sm' | 'md';
  /** Stable id root for the tab/panel `id` + `aria-controls` wiring. */
  idBase?: string;
  /** Optional panels rendered below the tablist. */
  children?: React.ReactNode;
}

interface TabsContextValue {
  value: string;
  idBase: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

/** Resolve the stable id for a tab/panel pair. */
function tabId(idBase: string, value: string): string {
  return `${idBase}-tab-${value}`;
}
function panelId(idBase: string, value: string): string {
  return `${idBase}-panel-${value}`;
}

const ICON_SIZE = { sm: 13, md: 14 } as const;

export function Tabs({
  items,
  value,
  onChange,
  fitted = false,
  size = 'md',
  idBase,
  className,
  children,
  ...rest
}: TabsProps): React.JSX.Element {
  const autoId = React.useId();
  const base = idBase ?? `t-${autoId}`;

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const indicatorRef = React.useRef<HTMLSpanElement | null>(null);

  // Slide the underline under the active tab using transform only.
  const positionIndicator = React.useCallback(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  }, []);

  React.useLayoutEffect(() => {
    positionIndicator();
  }, [positionIndicator, value, items, size, fitted]);

  // Reposition on container resize (font load, layout shift, responsive wraps).
  React.useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => positionIndicator());
    ro.observe(list);
    return () => ro.disconnect();
  }, [positionIndicator]);

  const enabledValues = React.useMemo(
    () => items.filter((i) => !i.disabled).map((i) => i.value),
    [items],
  );

  const focusTab = React.useCallback((tabValue: string) => {
    const list = listRef.current;
    if (!list) return;
    list
      .querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(tabValue)}"]`)
      ?.focus();
  }, []);

  const moveTo = React.useCallback(
    (tabValue: string) => {
      onChange(tabValue);
      focusTab(tabValue);
    },
    [onChange, focusTab],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (enabledValues.length === 0) return;
    const isHorizontalNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const isHorizontalPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!isHorizontalNext && !isHorizontalPrev && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const current = enabledValues.indexOf(value);
    let next: number;
    if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = enabledValues.length - 1;
    } else if (isHorizontalNext) {
      next = current < 0 ? 0 : (current + 1) % enabledValues.length;
    } else {
      next =
        current < 0
          ? enabledValues.length - 1
          : (current - 1 + enabledValues.length) % enabledValues.length;
    }
    moveTo(enabledValues[next]);
  };

  const cls = [
    'u-tabs',
    `u-tabs--${size}`,
    fitted && 'u-tabs--fitted',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value, idBase: base }),
    [value, base],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cls} {...rest}>
        <div className="u-tabs__list" role="tablist" ref={listRef}>
          {items.map((item) => {
            const isActive = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={tabId(base, item.value)}
                className="u-tab"
                data-value={item.value}
                data-active={isActive || undefined}
                aria-selected={isActive}
                aria-controls={panelId(base, item.value)}
                aria-disabled={item.disabled || undefined}
                tabIndex={isActive ? 0 : -1}
                disabled={item.disabled}
                onClick={() => !item.disabled && onChange(item.value)}
                onKeyDown={onKeyDown}
              >
                {renderIcon(item.icon, { size: ICON_SIZE[size], 'aria-hidden': true })}
                <span className="u-tab__label">{item.label}</span>
                {item.badge != null ? (
                  <span className="u-tab__badge">{item.badge}</span>
                ) : null}
              </button>
            );
          })}
          <span className="u-tabs__indicator" ref={indicatorRef} aria-hidden="true" />
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Matches the `value` of the tab this panel belongs to. */
  value: string;
  /** Keep the panel mounted (hidden) when inactive instead of unmounting. */
  keepMounted?: boolean;
}

/** The `role=tabpanel` partner for a `Tabs` tab. Must be a descendant of `Tabs`. */
export function TabPanel({
  value,
  keepMounted = false,
  className,
  children,
  ...rest
}: TabPanelProps): React.JSX.Element | null {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error('TabPanel must be rendered inside a <Tabs>.');
  }
  const isActive = ctx.value === value;
  if (!isActive && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(ctx.idBase, value)}
      aria-labelledby={tabId(ctx.idBase, value)}
      tabIndex={0}
      hidden={!isActive || undefined}
      className={['u-tabpanel', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Tabs;
