'use client';

import * as React from 'react';

import { Search, UserCheck } from 'lucide-react';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import type {
  BugListParams,
  BugPriority,
  BugSeverity,
  BugStatus,
} from '@/lib/rust-client/sabbugs-bugs';

import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  BUG_STATUSES,
  prettyPriority,
  prettySeverity,
  prettyStatus,
  type ProjectOption,
} from './bug-shared';

export interface BugFiltersValue {
  q?: string;
  status?: BugStatus | 'all';
  severity?: BugSeverity;
  priority?: BugPriority;
  projectId?: string;
  mine?: boolean;
}

export interface BugFiltersProps {
  value: BugFiltersValue;
  onChange: (next: BugFiltersValue) => void;
  projectOptions: ProjectOption[];
  /** Render a "Save current as…" trigger if provided. */
  onSaveCurrent?: () => void;
}

export function BugFilters({
  value,
  onChange,
  projectOptions,
  onSaveCurrent,
}: BugFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px] flex-1">
        <Input
          aria-label="Search bugs"
          iconLeft={Search}
          placeholder="Search bugs by title…"
          value={value.q ?? ''}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
        />
      </div>

      <Select
        value={value.status ?? 'active_visible'}
        onValueChange={(v) =>
          onChange({
            ...value,
            status: v === 'active_visible' ? undefined : (v as BugStatus | 'all'),
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active_visible">Active (default)</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
          {BUG_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {prettyStatus(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.severity ?? 'any'}
        onValueChange={(v) =>
          onChange({
            ...value,
            severity: v === 'any' ? undefined : (v as BugSeverity),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any severity</SelectItem>
          {BUG_SEVERITIES.map((s) => (
            <SelectItem key={s} value={s}>
              {prettySeverity(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.priority ?? 'any'}
        onValueChange={(v) =>
          onChange({
            ...value,
            priority: v === 'any' ? undefined : (v as BugPriority),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any priority</SelectItem>
          {BUG_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {prettyPriority(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.projectId ?? 'any'}
        onValueChange={(v) =>
          onChange({ ...value, projectId: v === 'any' ? undefined : v })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any project</SelectItem>
          {projectOptions.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={value.mine ? 'primary' : 'outline'}
        iconLeft={UserCheck}
        aria-pressed={Boolean(value.mine)}
        onClick={() => onChange({ ...value, mine: !value.mine })}
      >
        My bugs
      </Button>

      {onSaveCurrent ? (
        <Button type="button" variant="outline" onClick={onSaveCurrent}>
          Save filter
        </Button>
      ) : null}
    </div>
  );
}

export function toListParams(v: BugFiltersValue): BugListParams {
  return {
    q: v.q || undefined,
    status: v.status,
    severity: v.severity,
    priority: v.priority,
    projectId: v.projectId,
    mine: v.mine || undefined,
  };
}
