"use client";

import { Badge, Button, Card, CardBody, DateRangePicker, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { ChevronDown, ListChecks, UserPlus, X } from "lucide-react";

/**
 * Filter row + bulk bar + saved-view preset menu for the Tickets list
 * page (1D.1).
 *
 * 8 filters: status, priority, severity, channel, category, assignee,
 * requester-type, date range.
 *
 * Bulk operations: assign, change priority, change status, merge,
 * delete, export.
 *
 * Saved presets: All, My tickets, Overdue SLA, High priority
 * unassigned, Resolved last 30d.
 */

import * as React from "react";
import type { DateRange } from "react-day-picker";

import { EntityFormField } from "@/components/crm/entity-form-field";
import { EnumFilterField } from "@/components/crm/enum-filter-field";

export type TicketRequesterKind = "client" | "lead" | "employee";
export type TicketStatusFilter =
  | "all"
  | "open"
  | "pending"
  | "on_hold"
  | "resolved"
  | "closed"
  | "reopened";

// CHANNEL_OPTIONS and SEVERITY_OPTIONS removed. Filter row uses EnumFilterField now.

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "on_hold", label: "On hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
] as const;

/* --- Filter row --- */

export interface TicketsFiltersRowProps {
  statusFilter: TicketStatusFilter;
  onStatusChange: (v: TicketStatusFilter) => void;
  priorityFilter: string;
  onPriorityChange: (v: string) => void;
  severityFilter: string;
  onSeverityChange: (v: string) => void;
  channelFilter: string;
  onChannelChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (v: string) => void;
  requesterKindFilter: TicketRequesterKind | "all";
  onRequesterKindChange: (v: TicketRequesterKind | "all") => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (r: DateRange | undefined) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function TicketsFiltersRow(props: TicketsFiltersRowProps) {
  return (
    <Card>
      <CardBody className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-4 lg:grid-cols-8">
        <FilterField label="Status">
          <EnumFilterField
            enumName="ticketStatus"
            value={props.statusFilter}
            onChange={(v) => props.onStatusChange(v as TicketStatusFilter)}
            allLabel="All"
          />
        </FilterField>

        <FilterField label="Priority">
          <EnumFilterField
            enumName="ticketPriority"
            value={props.priorityFilter || "all"}
            onChange={(v) => props.onPriorityChange(v === "all" ? "" : v)}
            allLabel="Any priority"
          />
        </FilterField>

        <FilterField label="Severity">
          <EnumFilterField
            enumName="ticketSeverity"
            value={props.severityFilter || "all"}
            onChange={(v) => props.onSeverityChange(v === "all" ? "" : v)}
            allLabel="Any severity"
          />
        </FilterField>

        <FilterField label="Channel">
          <EnumFilterField
            enumName="ticketChannel"
            value={props.channelFilter || "all"}
            onChange={(v) => props.onChannelChange(v === "all" ? "" : v)}
            allLabel="Any channel"
          />
        </FilterField>

        <FilterField label="Category">
          <EntityFormField
            entity="category"
            name="categoryFilter"
            initialId={props.categoryFilter || null}
            placeholder="Any"
            onChange={(next) => props.onCategoryChange(next ?? "")}
          />
        </FilterField>

        <FilterField label="Assignee">
          <EntityFormField
            entity="user"
            name="assigneeFilter"
            initialId={props.assigneeFilter || null}
            placeholder="Any"
            onChange={(next) => props.onAssigneeChange(next ?? "")}
          />
        </FilterField>

        <FilterField label="Requester">
          <EnumFilterField
            enumName="requesterKind"
            value={props.requesterKindFilter}
            onChange={(v) =>
              props.onRequesterKindChange(v as TicketRequesterKind | "all")
            }
            allLabel="Any requester"
          />
        </FilterField>

        <FilterField label="Created">
          <DateRangePicker
            value={props.dateRange}
            onChange={(r) => props.onDateRangeChange(r)}
          />
        </FilterField>

        {props.hasActiveFilters ? (
          <div className="flex items-end md:col-span-4 lg:col-span-8">
            <Button variant="ghost" size="sm" iconLeft={X} onClick={props.onClear}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/* --- Bulk bar --- */

export interface TicketsBulkBarProps {
  count: number;
  onClear: () => void;
  onAssign: (userId: string | null) => void;
  onPriority: (p: string) => void;
  onStatus: (s: string) => void;
  onMerge: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function TicketsBulkBar({
  count,
  onClear,
  onAssign,
  onPriority,
  onStatus,
  onMerge,
  onDelete,
  onExport,
}: TicketsBulkBarProps) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="info">{count} selected</Badge>

      <Select onValueChange={onStatus}>
        <SelectTrigger className="h-8 w-[150px]" aria-label="Set status">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={onPriority}>
        <SelectTrigger className="h-8 w-[150px]" aria-label="Set priority">
          <SelectValue placeholder="Set priority..." />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" iconLeft={UserPlus}>
            Assign...
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2">
          <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
            Assign to user
          </p>
          <EntityFormField
            entity="user"
            name="bulkAssign"
            initialId={null}
            placeholder="Pick a user..."
            onChange={(next) => {
              setAssignOpen(false);
              onAssign(next);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssignOpen(false);
              onAssign(null);
            }}
          >
            Unassign
          </Button>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="outline" onClick={onMerge}>
        Merge
      </Button>
      <Button size="sm" variant="outline" onClick={onExport}>
        Export CSV
      </Button>
      <Button size="sm" variant="destructive" onClick={onDelete}>
        Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

/* --- Saved views --- */

export interface TicketsViewPreset {
  id: string;
  label: string;
  description?: string;
}

export const TICKETS_VIEW_PRESETS: TicketsViewPreset[] = [
  { id: "all", label: "All tickets", description: "Default (no filters)" },
  {
    id: "my-tickets",
    label: "My tickets",
    description: "Assigned to me",
  },
  {
    id: "overdue",
    label: "Overdue SLA",
    description: "Due-by before now and not resolved",
  },
  {
    id: "high-unassigned",
    label: "High-priority unassigned",
    description: "Priority high or above, no agent",
  },
  {
    id: "resolved-30",
    label: "Resolved (30d)",
    description: "Resolved in last 30 days",
  },
];

export interface TicketsViewState {
  statusFilter: TicketStatusFilter;
  priorityFilter: string;
  severityFilter: string;
  channelFilter: string;
  categoryFilter: string;
  assigneeFilter: string;
  requesterKindFilter: TicketRequesterKind | "all";
  dateRange?: DateRange;
  /** Filter callback layered on top of the server filter set. */
  clientPredicate?: (t: Record<string, unknown>) => boolean;
}

export function buildTicketsViewState(
  presetId: string,
  currentUserId: string | undefined,
): TicketsViewState {
  const base: TicketsViewState = {
    statusFilter: "all",
    priorityFilter: "",
    severityFilter: "",
    channelFilter: "",
    categoryFilter: "",
    assigneeFilter: "",
    requesterKindFilter: "all",
    dateRange: undefined,
  };

  switch (presetId) {
    case "my-tickets":
      return {
        ...base,
        assigneeFilter: currentUserId ?? "",
      };
    case "overdue":
      return {
        ...base,
        clientPredicate: (t) => {
          const due = (t as { dueBy?: string }).dueBy;
          const status = String(
            (t as { status?: string }).status ?? "",
          ).toLowerCase();
          if (!due) return false;
          if (status === "resolved" || status === "closed") return false;
          return new Date(due).getTime() < Date.now();
        },
      };
    case "high-unassigned":
      return {
        ...base,
        clientPredicate: (t) => {
          const p = String(
            (t as { priority?: string }).priority ?? "",
          ).toLowerCase();
          const a = (t as { assigneeId?: string }).assigneeId;
          return (p === "high" || p === "critical") && !a;
        },
      };
    case "resolved-30": {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return {
        ...base,
        statusFilter: "resolved",
        clientPredicate: (t) => {
          const ts =
            (t as { updatedAt?: string }).updatedAt ??
            (t as { audit?: { updatedAt?: string } }).audit?.updatedAt;
          if (!ts) return false;
          return new Date(ts).getTime() >= cutoff;
        },
      };
    }
    default:
      return base;
  }
}

export interface TicketsViewsMenuProps {
  activePresetId?: string;
  onSelect: (presetId: string) => void;
}

export function TicketsViewsMenu({
  activePresetId,
  onSelect,
}: TicketsViewsMenuProps) {
  const active =
    TICKETS_VIEW_PRESETS.find((p) => p.id === activePresetId) ??
    TICKETS_VIEW_PRESETS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" iconLeft={ListChecks} iconRight={ChevronDown}>
          {active.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TICKETS_VIEW_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => onSelect(preset.id)}
          >
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{preset.label}</span>
              {preset.description ? (
                <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                  {preset.description}
                </span>
              ) : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
