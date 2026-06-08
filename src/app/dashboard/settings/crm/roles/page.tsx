'use client';

/**
 * SabCRM - Roles & Permissions settings (`/dashboard/settings/crm/roles`).
 *
 * A two-pane "Roles" screen:
 *   - LEFT pane lists every role for the active project (name, member count,
 *     default badge) with a "New role" action.
 *   - RIGHT pane is the editor for the selected role:
 *       . editable name + description (saved via `updateRoleTw`),
 *       . a permission matrix - toggle rows for each capability key,
 *         persisted with `updateRoleTw({ permissions })`,
 *       . permission depth (parallel role-shape additions):
 *           - a Defaults card of workspace-wide CRUD grants
 *             (`updateRoleTw({ defaults })`),
 *           - an Objects matrix of per-object tri-state Read/Update/Delete/
 *             Destroy overrides (`updateRoleTw({ objectPermissions })`),
 *           - a Fields editor (pick object, per-field Read/Edit tri-state,
 *             `updateRoleTw({ fieldPermissions })`),
 *           - a Capabilities checklist of settings/tool permission flags
 *             (`updateRoleTw({ permissionFlags })`),
 *         all sourcing the object/field catalogue from `listSabcrmObjectsTw`,
 *       . a member roster (from `listMembersAction`) where each row toggles
 *         assignment to this role via `setRoleMemberTw`, with assigned members
 *         surfaced as Avatar chips,
 *       . delete (confirm) for non-default roles.
 *
 * Every mutation goes through the gated server actions in
 * `@/app/actions/sabcrm-roles.actions` (session, project, RBAC, plan), which
 * wrap the roles engine. That engine may be DOWN; each call returns an
 * `ActionResult`, so the page degrades to loading / empty / error states and
 * never crashes. Auth / RBAC / project context are enforced by the parent
 * `../../layout.tsx`; the actions independently re-run the full gate.
 *
 * Pure 20ui design system (`@/components/sabcrm/20ui`).
 */

import * as React from 'react';
import {
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  Check,
  X,
  Eye,
  Pencil,
  Settings,
  Users,
  Database,
  Boxes,
  Columns3,
  ToggleRight,
  KeyRound,
  Workflow,
  Webhook,
  Lock,
  Minus,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Textarea,
  Switch,
  Checkbox,
  Badge,
  Avatar,
  Alert,
  EmptyState,
  Skeleton,
  Spinner,
  Modal,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import {
  listRolesTw,
  createRoleTw,
  updateRoleTw,
  deleteRoleTw,
  setRoleMemberTw,
} from '@/app/actions/sabcrm-roles.actions';
import { listSabcrmObjectsTw } from '@/app/actions/sabcrm-twenty.actions';
import type { CrmMember } from '@/lib/sabcrm/members.server';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Role shape (mirrors the `sabcrm-roles.actions` payload).
// ---------------------------------------------------------------------------

/** A per-object CRUD override carried on the role. Absent flag = "Default". */
interface ObjectPermission {
  object: string;
  read?: boolean;
  update?: boolean;
  softDelete?: boolean;
  destroy?: boolean;
}

/** A per-field read/edit override carried on the role. */
interface FieldPermission {
  object: string;
  field: string;
  read?: boolean;
  update?: boolean;
}

/** Workspace-level default CRUD grants the role falls back to. */
interface RoleDefaults {
  canReadAll?: boolean;
  canUpdateAll?: boolean;
  canSoftDeleteAll?: boolean;
  canDestroyAll?: boolean;
}

interface CrmRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  memberIds: string[];
  isDefault?: boolean;
  /** Permission depth (added in parallel; may be absent on old docs). */
  defaults?: RoleDefaults;
  objectPermissions?: ObjectPermission[];
  fieldPermissions?: FieldPermission[];
  permissionFlags?: string[];
}

/** Tri-state for an object/field CRUD cell. */
type TriState = 'default' | 'allow' | 'deny';

/** Maps an optional boolean override to its tri-state. */
function toTri(v: boolean | undefined): TriState {
  if (v === true) return 'allow';
  if (v === false) return 'deny';
  return 'default';
}

/** Maps a tri-state back to the optional boolean stored on the wire. */
function fromTri(t: TriState): boolean | undefined {
  if (t === 'allow') return true;
  if (t === 'deny') return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Permission catalogue - the fixed set of capability keys a role can grant.
// ---------------------------------------------------------------------------

interface PermissionInfo {
  key: string;
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const PERMISSIONS: ReadonlyArray<PermissionInfo> = [
  {
    key: 'records:read',
    label: 'View records',
    desc: 'Read records across the CRM objects.',
    Icon: Eye,
  },
  {
    key: 'records:write',
    label: 'Create & edit records',
    desc: 'Add new records and modify existing ones.',
    Icon: Pencil,
  },
  {
    key: 'records:delete',
    label: 'Delete records',
    desc: 'Permanently remove records.',
    Icon: Trash2,
  },
  {
    key: 'settings:manage',
    label: 'Manage settings',
    desc: 'Edit the data model, views, automations and integrations.',
    Icon: Settings,
  },
  {
    key: 'members:manage',
    label: 'Manage members',
    desc: 'Invite, assign roles to, and remove workspace members.',
    Icon: Users,
  },
];

// ---------------------------------------------------------------------------
// Defaults - workspace-wide fallback CRUD grants.
// ---------------------------------------------------------------------------

interface DefaultInfo {
  key: keyof RoleDefaults;
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const DEFAULTS: ReadonlyArray<DefaultInfo> = [
  {
    key: 'canReadAll',
    label: 'View all records',
    desc: 'See records of every object unless an object override denies it.',
    Icon: Eye,
  },
  {
    key: 'canUpdateAll',
    label: 'Edit all records',
    desc: 'Create and update records of every object by default.',
    Icon: Pencil,
  },
  {
    key: 'canSoftDeleteAll',
    label: 'Delete all records',
    desc: 'Move records of every object to the trash by default.',
    Icon: Trash2,
  },
  {
    key: 'canDestroyAll',
    label: 'Destroy all records',
    desc: 'Permanently destroy records of every object by default.',
    Icon: X,
  },
];

// ---------------------------------------------------------------------------
// Object-permission matrix - the four CRUD columns, each a tri-state cell.
// ---------------------------------------------------------------------------

interface CrudColumn {
  key: keyof Omit<ObjectPermission, 'object'>;
  label: string;
  Icon: React.ElementType;
}

const CRUD_COLUMNS: ReadonlyArray<CrudColumn> = [
  { key: 'read', label: 'Read', Icon: Eye },
  { key: 'update', label: 'Update', Icon: Pencil },
  { key: 'softDelete', label: 'Delete', Icon: Trash2 },
  { key: 'destroy', label: 'Destroy', Icon: X },
];

/** Field-permission columns - read + edit only at the field level. */
const FIELD_COLUMNS: ReadonlyArray<CrudColumn> = [
  { key: 'read', label: 'Read', Icon: Eye },
  { key: 'update', label: 'Edit', Icon: Pencil },
];

// ---------------------------------------------------------------------------
// Capability flags - the settings + tool permission flags checklist.
// ---------------------------------------------------------------------------

interface FlagInfo {
  key: string;
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const PERMISSION_FLAGS: ReadonlyArray<FlagInfo> = [
  {
    key: 'WORKSPACE',
    label: 'Workspace',
    desc: 'Edit general workspace settings, identity and domains.',
    Icon: Settings,
  },
  {
    key: 'WORKSPACE_MEMBERS',
    label: 'Members',
    desc: 'Invite, manage and remove workspace members.',
    Icon: Users,
  },
  {
    key: 'ROLES',
    label: 'Roles',
    desc: 'Create roles and assign permissions to them.',
    Icon: Shield,
  },
  {
    key: 'DATA_MODEL',
    label: 'Data model',
    desc: 'Create and edit objects, fields and relations.',
    Icon: Database,
  },
  {
    key: 'API_KEYS_AND_WEBHOOKS',
    label: 'API & Webhooks',
    desc: 'Manage API keys and outgoing webhooks.',
    Icon: Webhook,
  },
  {
    key: 'WORKFLOWS',
    label: 'Workflows',
    desc: 'Build, edit and run automation workflows.',
    Icon: Workflow,
  },
  {
    key: 'SECURITY',
    label: 'Security',
    desc: 'Manage SSO, approved domains and security policies.',
    Icon: Lock,
  },
  {
    key: 'IMPERSONATE',
    label: 'Impersonate',
    desc: 'Sign in as another member for support and debugging.',
    Icon: KeyRound,
  },
];

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Inline saving / saved / error status shown beside a block head. */
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveStatus({ state }: { state: SaveState }): React.JSX.Element | null {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
        <Spinner size={13} label="Saving" /> Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--st-status-ok)]">
        <Check size={13} aria-hidden="true" /> Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--st-danger)]">
        <X size={13} aria-hidden="true" /> Not saved
      </span>
    );
  }
  return null;
}

/** A loading skeleton stack for a pane. */
function PaneSkeleton({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-3)]">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={18} radius={6} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane - role list
// ---------------------------------------------------------------------------

interface RoleListProps {
  roles: CrmRole[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  creating: boolean;
}

function RoleList({
  roles,
  activeId,
  onSelect,
  onNew,
  creating,
}: RoleListProps): React.JSX.Element {
  return (
    <nav className="flex flex-col gap-2" aria-label="Roles">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">Roles</h2>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={Plus}
          onClick={onNew}
          loading={creating}
        >
          New role
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {roles.length === 0 ? (
          <p className="px-1 py-2 text-sm text-[var(--st-text-tertiary)]">
            No roles yet.
          </p>
        ) : (
          roles.map((role) => {
            const active = role.id === activeId;
            const count = role.memberIds.length;
            return (
              <Button
                key={role.id}
                variant={active ? 'outline' : 'ghost'}
                block
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(role.id)}
                className={[
                  'h-auto !justify-start gap-2.5 px-3 py-2 text-left',
                  active
                    ? '!border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : '',
                ].join(' ')}
              >
                <span className="flex w-full items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  >
                    {role.isDefault ? (
                      <ShieldCheck size={15} />
                    ) : (
                      <Shield size={15} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
                      <span className="truncate">{role.name}</span>
                      {role.isDefault ? (
                        <Badge tone="accent" kind="soft">
                          Default
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-[var(--st-text-tertiary)]">
                      {count} member{count !== 1 ? 's' : ''}
                    </span>
                  </span>
                </span>
              </Button>
            );
          })
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane - role editor: name + description block
// ---------------------------------------------------------------------------

interface IdentityBlockProps {
  role: CrmRole;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function IdentityBlock({
  role,
  projectId,
  onSaved,
}: IdentityBlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [name, setName] = React.useState(role.name);
  const [description, setDescription] = React.useState(role.description ?? '');
  const [state, setState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync the form when the selected role changes underneath us.
  React.useEffect(() => {
    setName(role.name);
    setDescription(role.description ?? '');
    setState('idle');
    setError(null);
  }, [role.id, role.name, role.description]);

  const dirty =
    name.trim() !== role.name || description.trim() !== (role.description ?? '');
  const canSave = dirty && name.trim().length > 0 && state !== 'saving';

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setState('saving');
    setError(null);
    const res = await updateRoleTw(
      role.id,
      { name: name.trim(), description: description.trim() || undefined },
      projectId ?? undefined,
    );
    if (res.ok) {
      setState('saved');
      onSaved(res.data);
      toast.success('Role details saved');
    } else {
      setState('error');
      setError(res.error);
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Details</CardTitle>
          <CardDescription>The role&apos;s name and description.</CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <Field label="Name" required error={error ?? undefined}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setState('idle');
            }}
            placeholder="Sales rep"
            autoComplete="off"
            disabled={role.isDefault}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setState('idle');
            }}
            placeholder="What this role is allowed to do."
            rows={2}
          />
        </Field>
        <div>
          <Button
            variant="primary"
            disabled={!canSave}
            loading={state === 'saving'}
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - permission matrix
// ---------------------------------------------------------------------------

interface PermissionBlockProps {
  role: CrmRole;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function PermissionBlock({
  role,
  projectId,
  onSaved,
}: PermissionBlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [state, setState] = React.useState<SaveState>('idle');
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const granted = React.useMemo(
    () => new Set(role.permissions),
    [role.permissions],
  );

  const handleToggle = async (key: string, next: boolean): Promise<void> => {
    if (role.isDefault) return;
    const nextPerms = new Set(role.permissions);
    if (next) nextPerms.add(key);
    else nextPerms.delete(key);

    setBusyKey(key);
    setState('saving');
    const res = await updateRoleTw(
      role.id,
      { permissions: Array.from(nextPerms) },
      projectId ?? undefined,
    );
    setBusyKey(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data);
    } else {
      setState('error');
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Capabilities granted to everyone with this role.
          </CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {role.isDefault ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            The default role&apos;s permissions are managed by the system and
            cannot be edited.
          </p>
        ) : null}
        <div
          className="flex flex-col gap-1"
          role="group"
          aria-label="Permission matrix"
        >
          {PERMISSIONS.map((perm) => {
            const { Icon } = perm;
            const checked = granted.has(perm.key);
            const busy = busyKey === perm.key;
            const disabled = role.isDefault || busy;
            return (
              <div
                key={perm.key}
                className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                >
                  <Icon size={15} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    {perm.label}
                  </span>
                  <span className="font-mono text-xs text-[var(--st-text-tertiary)]">
                    {perm.key}
                  </span>
                </span>
                {busy ? <Spinner size={14} label="Saving" /> : null}
                <Switch
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => handleToggle(perm.key, value)}
                  aria-label={perm.label}
                />
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - Defaults card (workspace-wide fallback CRUD grants)
// ---------------------------------------------------------------------------

interface BlockProps {
  role: CrmRole;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function DefaultsBlock({
  role,
  projectId,
  onSaved,
}: BlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [state, setState] = React.useState<SaveState>('idle');
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const defaults = role.defaults ?? {};

  const handleToggle = async (
    key: keyof RoleDefaults,
    next: boolean,
  ): Promise<void> => {
    if (role.isDefault) return;
    setBusyKey(key);
    setState('saving');
    const res = await updateRoleTw(
      role.id,
      { defaults: { ...defaults, [key]: next } },
      projectId ?? undefined,
    );
    setBusyKey(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data as CrmRole);
    } else {
      setState('error');
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            Workspace-wide grants this role falls back to when no object or field
            override applies.
          </CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {role.isDefault ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            The default role&apos;s grants are managed by the system.
          </p>
        ) : null}
        <div
          className="flex flex-col gap-1"
          role="group"
          aria-label="Default grants"
        >
          {DEFAULTS.map((d) => {
            const { Icon } = d;
            const checked = defaults[d.key] === true;
            const busy = busyKey === d.key;
            const disabled = role.isDefault || busy;
            return (
              <div
                key={d.key}
                className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                >
                  <Icon size={15} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    {d.label}
                  </span>
                  <span className="text-xs text-[var(--st-text-tertiary)]">
                    {d.desc}
                  </span>
                </span>
                {busy ? <Spinner size={14} label="Saving" /> : null}
                <Switch
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => handleToggle(d.key, value)}
                  aria-label={d.label}
                />
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tri-state CRUD cell (Default / Allow / Deny) used by the object + field grids
// ---------------------------------------------------------------------------

interface TriCellProps {
  value: TriState;
  disabled: boolean;
  busy: boolean;
  label: string;
  onChange: (next: TriState) => void;
}

const TRI_ORDER: ReadonlyArray<TriState> = ['default', 'allow', 'deny'];
const TRI_NEXT_LABEL: Record<TriState, string> = {
  default: 'Default',
  allow: 'Allow',
  deny: 'Deny',
};
const TRI_TONE: Record<TriState, string> = {
  default: 'text-[var(--st-text-tertiary)] border-[var(--st-border)]',
  allow: 'text-[var(--st-status-ok)] border-[var(--st-status-ok)]',
  deny: 'text-[var(--st-danger)] border-[var(--st-danger)]',
};

function TriGlyph({ value }: { value: TriState }): React.JSX.Element {
  if (value === 'allow') return <Check size={13} aria-hidden="true" />;
  if (value === 'deny') return <X size={13} aria-hidden="true" />;
  return <Minus size={13} aria-hidden="true" />;
}

function TriCell({
  value,
  disabled,
  busy,
  label,
  onChange,
}: TriCellProps): React.JSX.Element {
  const cycle = (): void => {
    if (disabled) return;
    const idx = TRI_ORDER.indexOf(value);
    onChange(TRI_ORDER[(idx + 1) % TRI_ORDER.length]!);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycle}
      disabled={disabled}
      aria-label={`${label}: ${TRI_NEXT_LABEL[value]}`}
      title={TRI_NEXT_LABEL[value]}
      className={['h-7 w-7 !p-0', TRI_TONE[value]].join(' ')}
    >
      {busy ? <Spinner size={12} label="Saving" /> : <TriGlyph value={value} />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Right pane - Object-permission matrix (per object, tri-state CRUD)
// ---------------------------------------------------------------------------

interface ObjectFieldBlockProps extends BlockProps {
  objects: ObjectMetadata[];
  objectsLoading: boolean;
  objectsError: string | null;
}

function ObjectPermissionBlock({
  role,
  projectId,
  onSaved,
  objects,
  objectsLoading,
  objectsError,
}: ObjectFieldBlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [state, setState] = React.useState<SaveState>('idle');
  const [busy, setBusy] = React.useState<string | null>(null);

  const byObject = React.useMemo(() => {
    const map = new Map<string, ObjectPermission>();
    for (const op of role.objectPermissions ?? []) map.set(op.object, op);
    return map;
  }, [role.objectPermissions]);

  const handleChange = async (
    object: string,
    column: keyof Omit<ObjectPermission, 'object'>,
    next: TriState,
  ): Promise<void> => {
    if (role.isDefault) return;
    const current = role.objectPermissions ?? [];
    const existing = byObject.get(object) ?? { object };
    const updatedEntry: ObjectPermission = {
      ...existing,
      [column]: fromTri(next),
    };
    // Drop the entry entirely if every column is back to "default".
    const meaningful =
      updatedEntry.read !== undefined ||
      updatedEntry.update !== undefined ||
      updatedEntry.softDelete !== undefined ||
      updatedEntry.destroy !== undefined;
    const without = current.filter((op) => op.object !== object);
    const nextList = meaningful ? [...without, updatedEntry] : without;

    setBusy(`${object}:${column}`);
    setState('saving');
    const res = await updateRoleTw(
      role.id,
      { objectPermissions: nextList },
      projectId ?? undefined,
    );
    setBusy(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data as CrmRole);
    } else {
      setState('error');
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Boxes size={15} aria-hidden="true" />
            Objects
          </CardTitle>
          <CardDescription>
            Override the defaults per object. Each cell cycles Default, Allow,
            Deny.
          </CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody>
        {objectsLoading ? (
          <PaneSkeleton rows={4} />
        ) : objectsError ? (
          <Alert tone="danger" title="Could not load objects">
            {objectsError}
          </Alert>
        ) : objects.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No objects in this project yet.
          </p>
        ) : (
          <Table density="compact" hover={false}>
            <THead>
              <Tr>
                <Th>Object</Th>
                {CRUD_COLUMNS.map((c) => (
                  <Th key={c.key} align="center">
                    {c.label}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {objects.map((obj) => {
                const op = byObject.get(obj.slug);
                return (
                  <Tr key={obj.slug}>
                    <Td>
                      {obj.labelPlural || obj.labelSingular || obj.slug}
                    </Td>
                    {CRUD_COLUMNS.map((c) => {
                      const tri = toTri(op?.[c.key]);
                      const cellBusy = busy === `${obj.slug}:${c.key}`;
                      return (
                        <Td key={c.key} align="center">
                          <TriCell
                            value={tri}
                            disabled={role.isDefault}
                            busy={cellBusy}
                            label={`${obj.labelSingular || obj.slug} ${c.label}`}
                            onChange={(next) =>
                              handleChange(obj.slug, c.key, next)
                            }
                          />
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - Field-permission editor (pick object, per-field read/edit)
// ---------------------------------------------------------------------------

function FieldPermissionBlock({
  role,
  projectId,
  onSaved,
  objects,
  objectsLoading,
  objectsError,
}: ObjectFieldBlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [state, setState] = React.useState<SaveState>('idle');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string>('');

  // Default the picker to the first object once objects load / role changes.
  React.useEffect(() => {
    if (objects.length === 0) {
      setPicked('');
      return;
    }
    setPicked((prev) =>
      prev && objects.some((o) => o.slug === prev) ? prev : objects[0]!.slug,
    );
  }, [objects, role.id]);

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === picked) ?? null,
    [objects, picked],
  );

  const byField = React.useMemo(() => {
    const map = new Map<string, FieldPermission>();
    for (const fp of role.fieldPermissions ?? [])
      if (fp.object === picked) map.set(fp.field, fp);
    return map;
  }, [role.fieldPermissions, picked]);

  const handleChange = async (
    field: string,
    column: 'read' | 'update',
    next: TriState,
  ): Promise<void> => {
    if (role.isDefault || !picked) return;
    const current = role.fieldPermissions ?? [];
    const existing =
      current.find((fp) => fp.object === picked && fp.field === field) ??
      ({ object: picked, field } as FieldPermission);
    const updatedEntry: FieldPermission = {
      ...existing,
      [column]: fromTri(next),
    };
    const meaningful =
      updatedEntry.read !== undefined || updatedEntry.update !== undefined;
    const without = current.filter(
      (fp) => !(fp.object === picked && fp.field === field),
    );
    const nextList = meaningful ? [...without, updatedEntry] : without;

    setBusy(`${field}:${column}`);
    setState('saving');
    const res = await updateRoleTw(
      role.id,
      { fieldPermissions: nextList },
      projectId ?? undefined,
    );
    setBusy(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data as CrmRole);
    } else {
      setState('error');
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Columns3 size={15} aria-hidden="true" />
            Fields
          </CardTitle>
          <CardDescription>
            Restrict read or edit access to individual fields of an object.
          </CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {objectsLoading ? (
          <PaneSkeleton rows={4} />
        ) : objectsError ? (
          <Alert tone="danger" title="Could not load objects">
            {objectsError}
          </Alert>
        ) : objects.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No objects in this project yet.
          </p>
        ) : (
          <>
            <Field label="Object">
              <Select
                value={picked}
                onValueChange={(value) => {
                  setPicked(value);
                  setState('idle');
                }}
              >
                <SelectTrigger aria-label="Pick an object to edit field permissions">
                  <SelectValue placeholder="Select an object" />
                </SelectTrigger>
                <SelectContent>
                  {objects.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.labelPlural || o.labelSingular || o.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {activeObject && activeObject.fields.length > 0 ? (
              <Table density="compact" hover={false}>
                <THead>
                  <Tr>
                    <Th>Field</Th>
                    {FIELD_COLUMNS.map((c) => (
                      <Th key={c.key} align="center">
                        {c.label}
                      </Th>
                    ))}
                  </Tr>
                </THead>
                <TBody>
                  {activeObject.fields.map((f) => {
                    const fp = byField.get(f.key);
                    return (
                      <Tr key={f.key}>
                        <Td>
                          <span className="flex flex-col">
                            <span className="text-[var(--st-text)]">
                              {f.label || f.key}
                            </span>
                            <span className="font-mono text-xs text-[var(--st-text-tertiary)]">
                              {f.key}
                            </span>
                          </span>
                        </Td>
                        {FIELD_COLUMNS.map((c) => {
                          const col = c.key as 'read' | 'update';
                          const tri = toTri(fp?.[col]);
                          const cellBusy = busy === `${f.key}:${col}`;
                          return (
                            <Td key={c.key} align="center">
                              <TriCell
                                value={tri}
                                disabled={role.isDefault}
                                busy={cellBusy}
                                label={`${f.label || f.key} ${c.label}`}
                                onChange={(next) =>
                                  handleChange(f.key, col, next)
                                }
                              />
                            </Td>
                          );
                        })}
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            ) : (
              <p className="text-sm text-[var(--st-text-secondary)]">
                This object has no fields.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - Capabilities checklist (permission flags)
// ---------------------------------------------------------------------------

function CapabilityBlock({
  role,
  projectId,
  onSaved,
}: BlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [state, setState] = React.useState<SaveState>('idle');
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const granted = React.useMemo(
    () => new Set(role.permissionFlags ?? []),
    [role.permissionFlags],
  );

  const handleToggle = async (key: string, next: boolean): Promise<void> => {
    if (role.isDefault) return;
    const set = new Set(role.permissionFlags ?? []);
    if (next) set.add(key);
    else set.delete(key);

    setBusyKey(key);
    setState('saving');
    const res = await updateRoleTw(
      role.id,
      { permissionFlags: Array.from(set) },
      projectId ?? undefined,
    );
    setBusyKey(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data as CrmRole);
    } else {
      setState('error');
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <ToggleRight size={15} aria-hidden="true" />
            Capabilities
          </CardTitle>
          <CardDescription>
            Settings and tools this role can access across the workspace.
          </CardDescription>
        </div>
        <SaveStatus state={state} />
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {role.isDefault ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            The default role&apos;s capabilities are managed by the system.
          </p>
        ) : null}
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="group"
          aria-label="Capability flags"
        >
          {PERMISSION_FLAGS.map((flag) => {
            const { Icon } = flag;
            const checked = granted.has(flag.key);
            const busy = busyKey === flag.key;
            const disabled = role.isDefault || busy;
            return (
              <label
                key={flag.key}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-[var(--st-radius)] border px-3 py-2.5 transition-colors',
                  checked
                    ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft,var(--st-bg-secondary))]'
                    : 'border-[var(--st-border)]',
                  disabled ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                {busy ? (
                  <span className="mt-0.5">
                    <Spinner size={14} label="Saving" />
                  </span>
                ) : (
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => handleToggle(flag.key, e.target.checked)}
                    aria-label={flag.label}
                  />
                )}
                <span
                  className="mt-0.5 text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                >
                  <Icon size={15} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-[var(--st-text)]">
                    {flag.label}
                  </span>
                  <span className="text-xs text-[var(--st-text-tertiary)]">
                    {flag.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - member assignment
// ---------------------------------------------------------------------------

interface MemberBlockProps {
  role: CrmRole;
  members: CrmMember[];
  membersLoading: boolean;
  membersError: string | null;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function MemberBlock({
  role,
  members,
  membersLoading,
  membersError,
  projectId,
  onSaved,
}: MemberBlockProps): React.JSX.Element {
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const assigned = React.useMemo(
    () => new Set(role.memberIds),
    [role.memberIds],
  );

  const assignedMembers = React.useMemo(
    () => members.filter((m) => assigned.has(m.userId)),
    [members, assigned],
  );

  const handleToggle = async (
    member: CrmMember,
    next: boolean,
  ): Promise<void> => {
    setBusyId(member.userId);
    const res = await setRoleMemberTw(
      role.id,
      member.userId,
      next,
      projectId ?? undefined,
    );
    setBusyId(null);
    if (res.ok) {
      onSaved(res.data);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Card variant="outlined" padding="none">
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {assigned.size} member{assigned.size !== 1 ? 's' : ''} assigned to this
          role.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {/* Assigned-member chips. */}
        <div className="flex flex-wrap items-center gap-2">
          {assignedMembers.length === 0 ? (
            <span className="text-sm text-[var(--st-text-tertiary)]">
              No members assigned yet.
            </span>
          ) : (
            assignedMembers.map((m) => (
              <span
                key={m.userId}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-0.5 pe-2.5 ps-1 text-sm text-[var(--st-text)]"
              >
                <Avatar name={m.name.trim() || m.email} src={m.image} size="sm" />
                {m.name.trim() || m.email}
              </span>
            ))
          )}
        </div>

        {/* Roster: assign / unassign. */}
        {membersLoading ? (
          <PaneSkeleton rows={3} />
        ) : membersError ? (
          <Alert tone="danger" title="Could not load members">
            {membersError}
          </Alert>
        ) : members.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No workspace members found.
          </p>
        ) : (
          <div
            className="flex flex-col gap-1"
            role="group"
            aria-label="Assign members"
          >
            {members.map((m) => {
              const isAssigned = assigned.has(m.userId);
              const busy = busyId === m.userId;
              const name = m.name.trim() || m.email;
              return (
                <label
                  key={m.userId}
                  className={[
                    'flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2',
                    busy ? 'opacity-60' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <Checkbox
                    checked={isAssigned}
                    disabled={busy}
                    onChange={(e) => handleToggle(m, e.target.checked)}
                    aria-label={`Assign ${name} to ${role.name}`}
                  />
                  <Avatar name={name} src={m.image} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
                      {name}
                      {m.isOwner ? (
                        <span className="text-xs text-[var(--st-text-tertiary)]">
                          (owner)
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-[var(--st-text-tertiary)]">
                      {m.email}
                    </span>
                  </span>
                  {busy ? <Spinner size={14} label="Saving" /> : null}
                </label>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Delete-role confirm dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  role: CrmRole;
  projectId: string | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteDialog({
  role,
  projectId,
  onClose,
  onDeleted,
}: DeleteDialogProps): React.JSX.Element {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const res = await deleteRoleTw(role.id, projectId ?? undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(`${role.name} deleted`);
      onDeleted(role.id);
    } else {
      setError(res.error);
      toast.error(res.error);
    }
  };

  const memberCount = role.memberIds.length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete role"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            iconLeft={Trash2}
            onClick={handleDelete}
            loading={busy}
          >
            Delete role
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-[var(--st-text-secondary)]">
        Delete <strong className="text-[var(--st-text)]">{role.name}</strong>? Its{' '}
        {memberCount} member{memberCount !== 1 ? 's' : ''} will lose the
        permissions this role grants. This cannot be undone.
      </p>
      {error ? (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [roles, setRoles] = React.useState<CrmRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const [members, setMembers] = React.useState<CrmMember[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(true);
  const [membersError, setMembersError] = React.useState<string | null>(null);

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  const [objectsError, setObjectsError] = React.useState<string | null>(null);

  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // ---- Load roles ---------------------------------------------------------
  React.useEffect(() => {
    if (isLoadingProject) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await listRolesTw(activeProjectId ?? undefined);
        if (cancelled) return;
        if (res.ok) {
          setRoles(res.data);
          setActiveId((prev) => {
            if (prev && res.data.some((r) => r.id === prev)) return prev;
            return res.data.length > 0 ? res.data[0]!.id : null;
          });
        } else {
          setError(res.error);
          setRoles([]);
        }
      } catch {
        if (!cancelled) {
          setError('Roles could not be loaded. The service may be unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  // ---- Load members (for the roster) -------------------------------------
  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    (async () => {
      try {
        const res = await listMembersAction(activeProjectId);
        if (cancelled) return;
        if (res.ok) setMembers(res.data);
        else setMembersError(res.error);
      } catch {
        if (!cancelled) {
          setMembersError('Members could not be loaded.');
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  // ---- Load objects (for the object + field permission grids) ------------
  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setObjects([]);
      setObjectsLoading(false);
      return;
    }
    let cancelled = false;
    setObjectsLoading(true);
    setObjectsError(null);
    (async () => {
      try {
        const res = await listSabcrmObjectsTw(activeProjectId);
        if (cancelled) return;
        if (res.ok) setObjects(res.data);
        else setObjectsError(res.error);
      } catch {
        if (!cancelled) {
          setObjectsError('Objects could not be loaded.');
        }
      } finally {
        if (!cancelled) setObjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  /** Replace one role in the list with its updated payload. */
  const upsertRole = React.useCallback((next: CrmRole) => {
    setRoles((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  const activeRole = React.useMemo(
    () => roles.find((r) => r.id === activeId) ?? null,
    [roles, activeId],
  );

  const handleNewRole = React.useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    const res = await createRoleTw(
      { name: 'New role', description: '', permissions: [] },
      activeProjectId ?? undefined,
    );
    setCreating(false);
    if (res.ok) {
      setRoles((prev) => [...prev, res.data]);
      setActiveId(res.data.id);
    } else {
      setCreateError(res.error);
    }
  }, [activeProjectId]);

  const handleDeleted = React.useCallback((id: string) => {
    setDeleteOpen(false);
    setRoles((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setActiveId((cur) =>
        cur === id ? (next.length > 0 ? next[0]!.id : null) : cur,
      );
      return next;
    });
  }, []);

  // ---- Render -------------------------------------------------------------

  return (
    <div className="20ui flex flex-col gap-5 p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Roles & Permissions</PageTitle>
          <PageDescription>
            Define roles, the permissions they grant, and which workspace members
            belong to each. Roles are scoped to the active project.
          </PageDescription>
        </PageHeaderHeading>
        {activeProjectId && roles.length > 0 ? (
          <PageActions>
            <Button
              variant="secondary"
              iconLeft={Plus}
              onClick={handleNewRole}
              loading={creating}
            >
              New role
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      {isLoadingProject || loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          <PaneSkeleton rows={5} />
          <PaneSkeleton rows={6} />
        </div>
      ) : !activeProjectId ? (
        <EmptyState
          icon={Shield}
          title="No project selected"
          description="Select a project to manage its roles and permissions."
        />
      ) : error ? (
        <Alert tone="danger" title="Could not load roles">
          {error}
        </Alert>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No roles yet"
          description="Create your first role to grant scoped permissions to members."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={handleNewRole}
              loading={creating}
            >
              New role
            </Button>
          }
        />
      ) : (
        <>
          {createError ? <Alert tone="danger">{createError}</Alert> : null}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
            <RoleList
              roles={roles}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setCreateError(null);
              }}
              onNew={handleNewRole}
              creating={creating}
            />

            {activeRole ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--st-text)]">
                    {activeRole.isDefault ? (
                      <ShieldCheck size={18} aria-hidden="true" />
                    ) : (
                      <Shield size={18} aria-hidden="true" />
                    )}
                    {activeRole.name}
                    {activeRole.isDefault ? (
                      <Badge tone="accent" kind="soft">
                        Default
                      </Badge>
                    ) : null}
                  </h2>
                  {!activeRole.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>

                <IdentityBlock
                  key={`id-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <PermissionBlock
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <DefaultsBlock
                  key={`def-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <ObjectPermissionBlock
                  key={`obj-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                  objects={objects}
                  objectsLoading={objectsLoading}
                  objectsError={objectsError}
                />
                <FieldPermissionBlock
                  key={`fld-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                  objects={objects}
                  objectsLoading={objectsLoading}
                  objectsError={objectsError}
                />
                <CapabilityBlock
                  key={`cap-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <MemberBlock
                  role={activeRole}
                  members={members}
                  membersLoading={membersLoading}
                  membersError={membersError}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-8 text-sm text-[var(--st-text-tertiary)]">
                Select a role to edit its permissions and members.
              </div>
            )}
          </div>
        </>
      )}

      {deleteOpen && activeRole && !activeRole.isDefault ? (
        <DeleteDialog
          role={activeRole}
          projectId={activeProjectId}
          onClose={() => setDeleteOpen(false)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
