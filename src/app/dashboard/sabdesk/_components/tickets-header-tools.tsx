"use client";

/**
 * Compound header tool group for the Tickets list page:
 *   • Saved-view dropdown (TicketsViewsMenu)
 *   • Table / Kanban / Queue / Inbox view switcher
 */

import * as React from "react";
import { KanbanSquare, LayoutList, List } from "lucide-react";

import { SegmentedControl, type SegmentedItem } from "@/components/sabcrm/20ui";

import { TicketsViewsMenu } from "./tickets-filters";

export type TicketsViewMode = "table" | "kanban" | "queue" | "inbox";

const VIEW_ITEMS: ReadonlyArray<SegmentedItem<TicketsViewMode>> = [
  { value: "table", label: "Table", icon: List },
  { value: "kanban", label: "Kanban", icon: KanbanSquare },
  { value: "queue", label: "Queue", icon: LayoutList },
  { value: "inbox", label: "Inbox", icon: List },
];

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
      <SegmentedControl<TicketsViewMode>
        items={VIEW_ITEMS}
        value={view}
        onChange={onViewChange}
        size="sm"
        aria-label="Tickets view mode"
      />
    </div>
  );
}

export default TicketsHeaderTools;
