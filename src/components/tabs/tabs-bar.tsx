"use client";

/**
 * TabsBar - horizontal strip of open module tabs.
 *
 *  - Renders inline above the page content; pinned tabs sort to the front.
 *  - Each tab shows the module gradient as an underline when active and
 *    a dot when inactive, plus the title and a close X (hidden for pinned).
 *  - Drag-and-drop reorders via the HTML5 DnD API (no extra deps). The
 *    pinned/unpinned partition is preserved (a pinned tab can't drop into
 *    the unpinned section and vice-versa).
 *  - Right-click opens a context menu: pin/unpin, close others, close all.
 *  - Overflow scrolls horizontally with hidden scrollbar; a soft fade
 *    indicates more content off-screen on either side.
 *  - Empty state: a subtle helper hint.
 *
 * Pure 20ui: menus use Menu / MenuItem / MenuSeparator, the close affordance
 * is an IconButton, and icons come from lucide-react. The right-click menu is
 * positioned at the cursor (the 20ui Menu is trigger-anchored only) but reuses
 * the same MenuItem rows so styling, motion, and a11y stay consistent.
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Pin, PinOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton, Menu, MenuItem, MenuSeparator } from "@/components/sabcrm/20ui";
import { useTabs } from "./tabs-context";
import type { Tab } from "./types";

/* ── Cursor-anchored context menu (right-click) ───────────────────── */

interface ContextMenuRow {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Optional leading node - e.g. a module hue dot. Decorative. */
  leading?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A fixed-position menu rendered at the pointer (right-click / computed coords).
 * The 20ui Menu anchors to a trigger, so this thin shell carries the position
 * while delegating each row to the shared MenuItem for styling + a11y.
 */
function CursorMenu({
  items,
  position,
  label,
  onClose,
}: {
  items: ContextMenuRow[];
  position: { x: number; y: number };
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // Roving focus across the visible rows, matching the 20ui Menu key model.
  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    if (rows.length === 0) return;
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => rows[(i + rows.length) % rows.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(current < 0 ? 0 : current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(current < 0 ? rows.length - 1 : current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(rows.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={ref}
      className="ui20 fixed z-[60] min-w-[184px] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-xl"
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label={label}
      onKeyDown={onListKeyDown}
    >
      {items.map((item, i) => (
        <MenuItem
          key={i}
          danger={item.danger}
          disabled={item.disabled}
          onSelect={() => {
            item.onClick();
            onClose();
          }}
        >
          <span className="flex items-center gap-2">
            {item.leading ? (
              <span className="shrink-0" aria-hidden="true">
                {item.leading}
              </span>
            ) : null}
            <span>{item.label}</span>
          </span>
        </MenuItem>
      ))}
    </div>
  );
}

/* ── TabChip ──────────────────────────────────────────────────────── */

const TabChip = React.forwardRef<
  HTMLDivElement,
  {
    tab: Tab;
    active: boolean;
    onFocus: () => void;
    onClose: () => void;
    onContextMenu: (pos: { x: number; y: number }) => void;
    draggable: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  }
>(function TabChip(
  {
    tab,
    active,
    onFocus,
    onClose,
    onContextMenu,
    draggable,
    onDragStart,
    onDragOver,
    onDrop,
  },
  ref,
) {
  const handleAuxClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Middle-click closes - matches browser convention.
      if (e.button === 1 && !tab.pinned) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose, tab.pinned],
  );

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={active}
      tabIndex={0}
      draggable={draggable}
      onClick={onFocus}
      onAuxClick={handleAuxClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus();
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (!tab.pinned) {
            e.preventDefault();
            onClose();
          }
        }
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative flex items-center gap-2 shrink-0 cursor-pointer select-none",
        "rounded-t-[var(--st-radius)] px-3 h-9 border-x border-t border-transparent",
        "transition-all duration-150",
        active
          ? "bg-[var(--st-bg)] border-[var(--st-border)] -mb-px"
          : cn(
              "bg-[var(--st-bg-secondary)] hover:bg-[var(--st-bg)]",
              tab.hue.hoverSoft,
              "text-[var(--st-text)] hover:text-[var(--st-text)]",
            ),
        tab.pinned ? "px-2.5" : "pr-2",
      )}
      title={tab.title}
    >
      {/* Active gradient underline pinned to the bottom of the chip */}
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-2 -bottom-[1.5px] h-[2px] rounded-full bg-gradient-to-r",
            tab.hue.gradient,
          )}
        />
      )}

      {/* Module hue dot (inactive) */}
      {!active && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full bg-gradient-to-br shrink-0", tab.hue.gradient)}
        />
      )}

      {tab.pinned ? (
        <Pin
          aria-hidden="true"
          className={cn("size-3 shrink-0", active ? tab.hue.ink : "text-[var(--st-text)]")}
        />
      ) : null}

      {/* Title - pinned tabs hide the label to stay compact */}
      {!tab.pinned && (
        <span
          className={cn(
            "max-w-[140px] truncate text-[12.5px] font-bold tracking-tight",
            active ? "text-[var(--st-text)]" : undefined,
          )}
        >
          {tab.title}
        </span>
      )}

      {/* Close button - hidden for pinned tabs */}
      {!tab.pinned && (
        <IconButton
          label={`Close ${tab.title}`}
          icon={X}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-0.5 shrink-0",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            active && "opacity-100",
          )}
        />
      )}
    </div>
  );
});

/* ── TabsBar ──────────────────────────────────────────────────────── */

export function TabsBar({ className }: { className?: string }) {
  const {
    tabs,
    activeId,
    focusTab,
    closeTab,
    closeOthers,
    closeAll,
    togglePin,
    reorderTab,
  } = useTabs();

  const [tabMenu, setTabMenu] = useState<{
    tab: Tab;
    position: { x: number; y: number };
  } | null>(null);
  const dragId = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll the active chip into view whenever it changes.
  useEffect(() => {
    if (!activeId) return;
    const chip = chipRefs.current.get(activeId);
    if (!chip) return;
    chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeId]);

  if (tabs.length === 0) {
    return (
      <div
        className={cn(
          "ui20 flex items-center h-10 px-4 text-[12px] font-bold tracking-tight text-[var(--st-text-secondary)] select-none",
          className,
        )}
      >
        Open a module from the dock to start a tab.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ui20 relative flex items-stretch h-10 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]",
        className,
      )}
    >
      {/* Scroll fade - left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--st-bg-secondary)] to-transparent z-10"
      />
      {/* Scroll fade - right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--st-bg-secondary)] to-transparent z-10"
      />

      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Open modules"
        className="flex items-end gap-0.5 flex-1 min-w-0 px-2 pt-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <TabChip
              key={tab.id}
              ref={(el) => {
                if (el) chipRefs.current.set(tab.id, el);
                else chipRefs.current.delete(tab.id);
              }}
              tab={tab}
              active={active}
              onFocus={() => focusTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onContextMenu={(position) => setTabMenu({ tab, position })}
              draggable
              onDragStart={(e) => {
                dragId.current = tab.id;
                e.dataTransfer.effectAllowed = "move";
                // Required for Firefox to recognise the drag.
                e.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragOver={(e) => {
                if (dragId.current && dragId.current !== tab.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId.current;
                dragId.current = null;
                if (from && from !== tab.id) reorderTab(from, tab.id);
              }}
            />
          );
        })}
      </div>

      {/* Overflow menu - quick access to all tabs */}
      <div className="shrink-0 self-center mr-1">
        <Menu
          align="end"
          label="All tabs"
          trigger={<IconButton label="All tabs" icon={ChevronDown} />}
        >
          {tabs.map((t) => (
            <MenuItem key={t.id} onSelect={() => focusTab(t.id)}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full bg-gradient-to-br shrink-0", t.hue.gradient)}
                />
                <span>{t.title}</span>
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem danger icon={X} onSelect={closeAll}>
            Close all
          </MenuItem>
        </Menu>
      </div>

      {/* Per-tab right-click menu */}
      {tabMenu && (
        <CursorMenu
          label={`${tabMenu.tab.title} options`}
          items={[
            {
              label: tabMenu.tab.pinned ? "Unpin tab" : "Pin tab",
              onClick: () => togglePin(tabMenu.tab.id),
              leading: tabMenu.tab.pinned ? (
                <PinOff className="size-3.5" />
              ) : (
                <Pin className="size-3.5" />
              ),
            },
            {
              label: "Close tab",
              onClick: () => closeTab(tabMenu.tab.id),
              disabled: tabMenu.tab.pinned,
              leading: <X className="size-3.5" />,
            },
            {
              label: "Close others",
              onClick: () => closeOthers(tabMenu.tab.id),
              disabled: tabs.length <= 1,
            },
            {
              label: "Close all",
              onClick: closeAll,
              danger: true,
            },
          ]}
          position={tabMenu.position}
          onClose={() => setTabMenu(null)}
        />
      )}
    </div>
  );
}
