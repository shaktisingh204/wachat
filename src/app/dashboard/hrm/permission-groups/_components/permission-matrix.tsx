'use client';

/**
 * <PermissionMatrix /> — module × action checkbox grid used in both the
 * create drawer and the edit page.
 */

import * as React from 'react';
import { Checkbox, Badge } from '@/components/sabcrm/20ui/compat';
import type { ModulePermission, PermissionAction } from '@/app/actions/hrm-permission-groups.actions.types';
/* ─── Config ─────────────────────────────────────────────────────────────── */

export const MODULES: { key: string; label: string; category: string }[] = [
  { key: 'crm_tasks', label: 'Tasks', category: 'CRM' },
  { key: 'crm_projects', label: 'Projects', category: 'CRM' },
  { key: 'crm_invoices', label: 'Invoices', category: 'CRM' },
  { key: 'crm_leaves', label: 'Leaves', category: 'CRM' },
  { key: 'crm_expenses', label: 'Expenses', category: 'CRM' },
  { key: 'crm_timesheets', label: 'Timesheets', category: 'CRM' },
  { key: 'hrm_roadmaps', label: 'Roadmaps', category: 'HRM' },
  { key: 'hrm_task_reports', label: 'Task Reports', category: 'HRM' },
  { key: 'hrm_portal', label: 'HR Portal', category: 'HRM' },
];

export const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function buildPermissionMap(
  permissions: ModulePermission[],
): Map<string, Set<PermissionAction>> {
  const map = new Map<string, Set<PermissionAction>>();
  for (const p of permissions) {
    map.set(p.module, new Set(p.actions));
  }
  return map;
}

export function permissionMapToArray(
  map: Map<string, Set<PermissionAction>>,
): ModulePermission[] {
  const result: ModulePermission[] = [];
  for (const [module, actions] of map.entries()) {
    if (actions.size > 0) {
      result.push({ module, actions: Array.from(actions) as PermissionAction[] });
    }
  }
  return result;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export interface PermissionMatrixProps {
  value: ModulePermission[];
  onChange: (next: ModulePermission[]) => void;
  readonly?: boolean;
}

export function PermissionMatrix({
  value,
  onChange,
  readonly = false,
}: PermissionMatrixProps): React.JSX.Element {
  const map = React.useMemo(() => buildPermissionMap(value), [value]);

  const toggle = React.useCallback(
    (module: string, action: PermissionAction) => {
      if (readonly) return;
      const next = new Map(map);
      const set = new Set(next.get(module) ?? []);
      if (set.has(action)) {
        set.delete(action);
      } else {
        set.add(action);
      }
      next.set(module, set);
      onChange(permissionMapToArray(next));
    },
    [map, onChange, readonly],
  );

  const toggleRow = React.useCallback(
    (module: string, checked: boolean) => {
      if (readonly) return;
      const next = new Map(map);
      next.set(
        module,
        checked ? new Set(ACTIONS.map((a) => a.key)) : new Set(),
      );
      onChange(permissionMapToArray(next));
    },
    [map, onChange, readonly],
  );

  const toggleCol = React.useCallback(
    (action: PermissionAction, checked: boolean) => {
      if (readonly) return;
      const next = new Map(map);
      for (const m of MODULES) {
        const set = new Set(next.get(m.key) ?? []);
        if (checked) set.add(action);
        else set.delete(action);
        next.set(m.key, set);
      }
      onChange(permissionMapToArray(next));
    },
    [map, onChange, readonly],
  );

  const categories = React.useMemo(() => {
    const cats = new Map<string, typeof MODULES>();
    for (const m of MODULES) {
      const list = cats.get(m.category) ?? [];
      list.push(m);
      cats.set(m.category, list);
    }
    return cats;
  }, []);

  return (
    <div className="overflow-x-auto rounded-md border border-zoru-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zoru-line bg-zoru-surface-2">
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              Module
            </th>
            {ACTIONS.map((a) => (
              <th
                key={a.key}
                className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted"
              >
                <div className="flex flex-col items-center gap-1">
                  {a.label}
                  {!readonly && (
                    <Checkbox
                      aria-label={`Toggle all ${a.label}`}
                      checked={MODULES.every((m) =>
                        map.get(m.key)?.has(a.key),
                      )}
                      onCheckedChange={(v) => toggleCol(a.key, Boolean(v))}
                      className="mt-0.5"
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(categories.entries()).map(([cat, mods]) => (
            <React.Fragment key={cat}>
              <tr className="bg-zoru-surface border-b border-zoru-line">
                <td
                  colSpan={5}
                  className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-zoru-ink-muted"
                >
                  {cat}
                </td>
              </tr>
              {mods.map((mod) => {
                const rowActions = map.get(mod.key) ?? new Set();
                const allChecked = ACTIONS.every((a) => rowActions.has(a.key));
                return (
                  <tr
                    key={mod.key}
                    className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {!readonly && (
                          <Checkbox
                            aria-label={`Toggle all for ${mod.label}`}
                            checked={allChecked}
                            onCheckedChange={(v) =>
                              toggleRow(mod.key, Boolean(v))
                            }
                          />
                        )}
                        <span className="text-[13px] text-zoru-ink">
                          {mod.label}
                        </span>
                      </div>
                    </td>
                    {ACTIONS.map((a) => (
                      <td key={a.key} className="px-3 py-2.5 text-center">
                        {readonly ? (
                          rowActions.has(a.key) ? (
                            <Badge variant="default" className="text-[10px]">
                              {a.label}
                            </Badge>
                          ) : (
                            <span className="text-zoru-ink-muted">—</span>
                          )
                        ) : (
                          <Checkbox
                            aria-label={`${mod.label} ${a.label}`}
                            checked={rowActions.has(a.key)}
                            onCheckedChange={() => toggle(mod.key, a.key)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
