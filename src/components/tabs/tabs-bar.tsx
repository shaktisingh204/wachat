"use client";

/**
 * TabsBar — horizontal strip of open module tabs.
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
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LuX, LuPin, LuPinOff, LuChevronDown } from "react-icons/lu";
import { useTabs } from "./tabs-context";
import type { Tab } from "./types";

/* ── ContextMenu (lightweight, in-file) ───────────────────────────── */

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

function ContextMenu({
  items,
  position,
  onClose,
}: {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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

  return (
    <div
      ref={ref}
      role="menu"
      style={{ top: position.y, left: position.x }}
      className="fixed z-[60] min-w-[180px] rounded-xl bg-white py-1 shadow-2xl ring-1 ring-zinc-200/80 backdrop-blur-xl"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] font-bold transition-colors",
            item.disabled
              ? "text-zinc-300 cursor-not-allowed"
              : item.danger
                ? "text-rose-600 hover:bg-rose-50"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
          )}
        >
          {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
          <span className="flex-1">{item.label}</span>
        </button>
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
      // Middle-click closes — matches browser convention.
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
        "rounded-t-xl px-3 h-9 border-x border-t border-transparent",
        "transition-all duration-150",
        active
          ? cn("bg-white border-zinc-200/80 -mb-px", "shadow-[0_-1px_0_rgba(255,255,255,0.9)_inset]")
          : cn("bg-zinc-50/70 hover:bg-white", tab.hue.hoverSoft, "text-zinc-600 hover:text-zinc-900"),
        tab.pinned ? "px-2.5" : "pr-2",
      )}
      title={tab.title}
    >
      {/* Active gradient underline pinned to the bottom of the chip */}
      {active && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-2 -bottom-[1.5px] h-[2px] rounded-full bg-gradient-to-r",
            tab.hue.gradient,
          )}
        />
      )}

      {/* Module hue dot (inactive) — replaced by a subtle dot for pinned tabs */}
      {!active && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full bg-gradient-to-br shrink-0", tab.hue.gradient)}
        />
      )}

      {tab.pinned ? (
        <LuPin
          aria-hidden
          className={cn("size-3 shrink-0", active ? tab.hue.ink : "text-zinc-500")}
        />
      ) : null}

      {/* Title — pinned tabs hide the label to stay compact */}
      {!tab.pinned && (
        <span
          className={cn(
            "max-w-[140px] truncate text-[12.5px] font-bold tracking-tight",
            active ? "text-zinc-900" : undefined,
          )}
        >
          {tab.title}
        </span>
      )}

      {/* Close button — hidden for pinned tabs */}
      {!tab.pinned && (
        <button
          type="button"
          aria-label={`Close ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-0.5 grid size-5 shrink-0 place-items-center rounded-md",
            "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/70",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            active && "opacity-100",
          )}
        >
          <LuX className="size-3" strokeWidth={2.5} />
        </button>
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
  const [overflowMenu, setOverflowMenu] = useState<{
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
          "flex items-center h-10 px-4 text-[12px] font-bold tracking-tight text-zinc-400 select-none",
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
        "relative flex items-stretch h-10 border-b border-zinc-200/80 bg-zinc-50/40",
        className,
      )}
    >
      {/* Scroll fade — left */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-zinc-50/80 to-transparent z-10"
      />
      {/* Scroll fade — right */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 top-0 bottom-0 w-6 bg-gradient-to-l from-zinc-50/80 to-transparent z-10"
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

      {/* Overflow menu — quick access to all tabs */}
      <button
        type="button"
        aria-label="All tabs"
        title="All tabs"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          setOverflowMenu({
            position: { x: rect.right - 220, y: rect.bottom + 4 },
          });
        }}
        className="grid size-9 shrink-0 self-center mr-1 place-items-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70 transition-colors"
      >
        <LuChevronDown className="size-4" />
      </button>

      {/* Per-tab right-click menu */}
      {tabMenu && (
        <ContextMenu
          items={[
            {
              label: tabMenu.tab.pinned ? "Unpin tab" : "Pin tab",
              onClick: () => togglePin(tabMenu.tab.id),
              icon: tabMenu.tab.pinned ? <LuPinOff className="size-3.5" /> : <LuPin className="size-3.5" />,
            },
            {
              label: "Close tab",
              onClick: () => closeTab(tabMenu.tab.id),
              disabled: tabMenu.tab.pinned,
              icon: <LuX className="size-3.5" />,
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

      {/* Overflow "all tabs" dropdown */}
      {overflowMenu && (
        <ContextMenu
          items={[
            ...tabs.map<MenuItem>((t) => ({
              label: t.title,
              onClick: () => focusTab(t.id),
              icon: (
                <span
                  className={cn("size-2 rounded-full bg-gradient-to-br", t.hue.gradient)}
                />
              ),
            })),
            { label: "Close all", onClick: closeAll, danger: true, icon: <LuX className="size-3.5" /> },
          ]}
          position={overflowMenu.position}
          onClose={() => setOverflowMenu(null)}
        />
      )}
    </div>
  );
}
