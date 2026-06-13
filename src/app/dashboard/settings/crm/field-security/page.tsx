'use client';

/**
 * SabCRM — Field-level security (`/dashboard/settings/crm/field-security`).
 *
 * A per-object access MATRIX: rows = the object's fields, columns = the SabCRM
 * roles (Admin / Manager / Member — the project owner always has full access
 * and is intentionally NOT a column), cells = an access Select
 * (Editable / Read-only / Hidden). The full grid for an object saves at once.
 *
 * A prominent ENFORCEMENT toggle gates the whole feature. It is DEFAULT-OFF:
 * while off, policies are stored but NOT applied — reads and writes behave
 * exactly as today. Turning it on is security-sensitive (it can hide fields and
 * reject writes that previously worked), so the page surfaces a warning and
 * documents the native-vs-Rust read-path gap.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Save, ShieldCheck, ShieldAlert, Lock } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Field,
  Switch,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listFlsPoliciesTw,
  saveFlsPoliciesTw,
  getFlsEnforcedTw,
  setFlsEnforcedTw,
} from '@/app/actions/sabcrm-fls.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import type { FlsPolicy, FlsAccess } from '@/lib/sabcrm/fls';

// ---------------------------------------------------------------------------
// Local wire shapes (free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}
interface FieldRow {
  key: string;
  label: string;
  type: string;
}

/** Role columns. The owner is omitted — owners always have full access. */
const ROLE_COLUMNS: ReadonlyArray<{ role: string; label: string }> = [
  { role: 'admin', label: 'Admin' },
  { role: 'manage', label: 'Manager' },
  { role: 'view', label: 'Member' },
];

const ACCESS_OPTIONS: ReadonlyArray<{ value: FlsAccess; label: string }> = [
  { value: 'editable', label: 'Editable' },
  { value: 'readonly', label: 'Read-only' },
  { value: 'hidden', label: 'Hidden' },
];

/** Matrix value: `grid[fieldKey][role] = access`. Absent ⇒ editable. */
type Grid = Record<string, Record<string, FlsAccess>>;

function gridFromPolicies(policies: FlsPolicy[]): Grid {
  const grid: Grid = {};
  for (const p of policies) {
    (grid[p.field] ??= {})[p.role] = p.access;
  }
  return grid;
}

function gridToPolicies(object: string, grid: Grid): FlsPolicy[] {
  const out: FlsPolicy[] = [];
  for (const [field, byRole] of Object.entries(grid)) {
    for (const [role, access] of Object.entries(byRole)) {
      // `editable` is the default — no need to persist it (keeps the doc small
      // and the off-state identical to today).
      if (access === 'editable') continue;
      out.push({ object, field, role, access });
    }
  }
  return out;
}

function accessOf(grid: Grid, field: string, role: string): FlsAccess {
  return grid[field]?.[role] ?? 'editable';
}

export default function FieldSecuritySettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [selectedObject, setSelectedObject] = React.useState<string>('');
  const [fields, setFields] = React.useState<FieldRow[]>([]);
  const [grid, setGrid] = React.useState<Grid>({});
  const [enforced, setEnforced] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [loadingGrid, setLoadingGrid] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [togglingEnforce, setTogglingEnforce] = React.useState(false);

  // Load the object list + the enforcement flag.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [objsRes, enfRes] = await Promise.all([
        listObjectsTw(activeProjectId),
        getFlsEnforcedTw(activeProjectId),
      ]);
      if (!alive) return;
      if (objsRes.ok) {
        const opts = objsRes.data.map((o) => ({
          value: o.slug,
          label: o.labelPlural || o.slug,
        }));
        setObjects(opts);
        setSelectedObject((cur) => cur || opts[0]?.value || '');
      } else {
        setError(objsRes.error);
      }
      if (enfRes.ok) setEnforced(enfRes.data.enforced);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  // Load the selected object's fields + its policy grid.
  React.useEffect(() => {
    if (!selectedObject || !activeProjectId) {
      setFields([]);
      setGrid({});
      return;
    }
    let alive = true;
    setLoadingGrid(true);
    (async () => {
      const [objRes, polRes] = await Promise.all([
        getObjectTw(selectedObject, activeProjectId),
        listFlsPoliciesTw(selectedObject, activeProjectId),
      ]);
      if (!alive) return;
      if (objRes.ok) {
        setFields(
          (objRes.data.fields ?? [])
            .filter((f) => !String(f.key).startsWith('__') && !f.system)
            .map((f) => ({
              key: f.key,
              label: f.label || f.key,
              type: String(f.type),
            })),
        );
      } else {
        setFields([]);
      }
      setGrid(polRes.ok ? gridFromPolicies(polRes.data) : {});
      setLoadingGrid(false);
    })();
    return () => {
      alive = false;
    };
  }, [selectedObject, activeProjectId]);

  function setCell(field: string, role: string, access: FlsAccess): void {
    setGrid((g) => ({
      ...g,
      [field]: { ...(g[field] ?? {}), [role]: access },
    }));
  }

  async function save(): Promise<void> {
    if (!selectedObject || !activeProjectId) return;
    setSaving(true);
    const policies = gridToPolicies(selectedObject, grid);
    const res = await saveFlsPoliciesTw(selectedObject, policies, activeProjectId);
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setGrid(gridFromPolicies(res.data));
    toast({
      title: 'Field security saved',
      description: enforced
        ? 'Enforcement is on — these rules now apply.'
        : 'Enforcement is off — rules are stored but not yet applied.',
      tone: 'success',
    });
  }

  async function toggleEnforce(next: boolean): Promise<void> {
    if (!activeProjectId) return;
    setTogglingEnforce(true);
    const res = await setFlsEnforcedTw(next, activeProjectId);
    setTogglingEnforce(false);
    if (!res.ok) {
      toast({
        title: 'Could not change enforcement',
        description: res.error,
        tone: 'danger',
      });
      return;
    }
    setEnforced(res.data.enforced);
    toast({
      title: res.data.enforced
        ? 'Field-security enforcement enabled'
        : 'Field-security enforcement disabled',
      description: res.data.enforced
        ? 'Hidden fields are now stripped on read and read-only edits are rejected (native read/write path).'
        : 'Behaviour reverts to before — no fields are hidden or write-blocked.',
      tone: res.data.enforced ? 'success' : 'neutral',
    });
  }

  const showGridSkeleton = loadingGrid || loading || isLoadingProject;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Field-level security</PageTitle>
          <PageDescription>
            Hide or lock individual fields per role. Rules are per object; the
            project owner always has full access.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Enforcement gate */}
      <Card className="mb-[var(--st-space-4)] flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
        <div className="flex items-start justify-between gap-[var(--st-space-3)]">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--st-text)]">
              <Lock size={16} aria-hidden="true" />
              Enforce field security
              <Badge tone={enforced ? 'success' : 'neutral'} kind="soft">
                {enforced ? 'On' : 'Off'}
              </Badge>
            </span>
            <span className="max-w-[60ch] text-[12px] text-[var(--st-text-secondary)]">
              When off, your rules are saved but never applied — reads and writes
              behave exactly as today. Turn it on to actually strip hidden fields
              on read and reject read-only edits.
            </span>
          </div>
          <Switch
            checked={enforced}
            aria-label="Enforce field security"
            disabled={togglingEnforce}
            onCheckedChange={toggleEnforce}
          />
        </div>

        <Alert
          tone={enforced ? 'warning' : 'info'}
          icon={enforced ? ShieldAlert : ShieldCheck}
        >
          {enforced ? (
            <>
              Enforcement is <strong>active</strong>. It applies to the native
              record read/write path only — records served directly by the Rust
              engine are <strong>not</strong> redacted by this setting. Review
              your rules on a running workspace before relying on them, and treat
              the Rust path separately.
            </>
          ) : (
            <>
              Enforcement is off (the safe default). Enabling it can hide fields
              and block writes that work today, so do it on a running workspace
              with a security review. It covers the native read/write path only —
              not the Rust engine read path.
            </>
          )}
        </Alert>
      </Card>

      {/* Object picker + matrix */}
      <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
        <div className="flex flex-wrap items-end justify-between gap-[var(--st-space-3)]">
          <Field label="Object" className="min-w-[220px]">
            <Select value={selectedObject} onValueChange={setSelectedObject}>
              <SelectTrigger aria-label="Object">
                <SelectValue placeholder="Select an object" />
              </SelectTrigger>
              <SelectContent>
                {objects.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            variant="primary"
            iconLeft={Save}
            onClick={save}
            loading={saving}
            disabled={saving || !selectedObject || fields.length === 0}
          >
            Save rules
          </Button>
        </div>

        {showGridSkeleton ? (
          <div className="flex flex-col gap-[var(--st-space-2)]">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !selectedObject ? (
          <EmptyState
            icon={ShieldCheck}
            title="Pick an object"
            description="Choose an object to configure per-role field access."
          />
        ) : fields.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No editable fields"
            description="This object has no user-editable fields to secure."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--st-border)]">
                  <th className="px-[var(--st-space-2)] py-[var(--st-space-2)] text-left font-semibold text-[var(--st-text)]">
                    Field
                  </th>
                  {ROLE_COLUMNS.map((c) => (
                    <th
                      key={c.role}
                      className="px-[var(--st-space-2)] py-[var(--st-space-2)] text-left font-semibold text-[var(--st-text)]"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr
                    key={f.key}
                    className="border-b border-[var(--st-border)] last:border-0"
                  >
                    <td className="px-[var(--st-space-2)] py-[var(--st-space-2)]">
                      <span className="font-medium text-[var(--st-text)]">
                        {f.label}
                      </span>
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        {f.type}
                      </span>
                    </td>
                    {ROLE_COLUMNS.map((c) => {
                      const value = accessOf(grid, f.key, c.role);
                      return (
                        <td
                          key={c.role}
                          className="px-[var(--st-space-2)] py-[var(--st-space-2)]"
                        >
                          <Select
                            value={value}
                            onValueChange={(v) =>
                              setCell(f.key, c.role, v as FlsAccess)
                            }
                          >
                            <SelectTrigger
                              aria-label={`${f.label} access for ${c.label}`}
                              className="min-w-[130px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_OPTIONS.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
