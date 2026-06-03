"use client";

/**
 * Compound header tool group for the Tickets list page:
 *   • Saved-view dropdown (TicketsViewsMenu)
 *   • Table / Kanban / Queue view switcher
 */

import * as React from "react";
import { KanbanSquare, LayoutList, List } from "lucide-react";

import { TicketsViewsMenu } from "./tickets-filters";

export type TicketsViewMode = "table" | "kanban" | "queue" | "inbox";

interface TicketsHeaderToolsProps {
  view: TicketsViewMode;
  onViewChange: (v: TicketsViewMode) => void;
  activePresetId: string;
  onSelectPreset: (presetId: string) => void;
}

export function TicketsHeaderTools({
  view,
  onViewChange,
  activePresetId,
  onSelectPreset,
}: TicketsHeaderToolsProps) {
  return (
    <div className="flex items-center gap-2">
      <TicketsViewsMenu
        activePresetId={activePresetId}
        onSelect={onSelectPreset}
      />
      <div className="inline-flex rounded-md border border-zoru-line p-0.5">
        <ViewToggle
          label="Table"
          icon={<List className="h-3.5 w-3.5" />}
          active={view === "table"}
          onClick={() => onViewChange("table")}
        />
        <ViewToggle
          label="Kanban"
          icon={<KanbanSquare className="h-3.5 w-3.5" />}
          active={view === "kanban"}
          onClick={() => onViewChange("kanban")}
        />
        <ViewToggle
          label="Queue"
          icon={<LayoutList className="h-3.5 w-3.5" />}
          active={view === "queue"}
          onClick={() => onViewChange("queue")}
        />
        <ViewToggle
          label="Inbox"
          icon={<List className="h-3.5 w-3.5" />}
          active={view === "inbox"}
          onClick={() => onViewChange("inbox")}
        />
      </div>
    </div>
  );
}

function ViewToggle({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]",
        active
          ? "bg-zoru-surface text-zoru-ink"
          : "text-zoru-ink-muted hover:text-zoru-ink",
      ].join(" ")}
    >
      {icon} {label}
    </button>
  );
}

export default TicketsHeaderTools;
