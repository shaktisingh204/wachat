'use client';

/**
 * Roles + row-level-security + user assignment editor.
 *
 * The condition input is a plain JSON textarea — a true visual rule
 * builder is deferred (TODO marker noted in the action layer).
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import {
  assignSabcreatorRole,
  createSabcreatorRole,
  unassignSabcreatorRole,
  updateSabcreatorRole,
} from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type {
  SabcreatorRoleDoc,
  SabcreatorRowLevelRule,
  SabcreatorRowLevelRuleKind,
} from '@/lib/rust-client/sabcreator-roles';
import type { SabcreatorRoleAssignmentDoc } from '@/lib/rust-client/sabcreator-role-assignments';

interface Props {
  app: SabcreatorAppDoc;
  initialRoles: SabcreatorRoleDoc[];
  initialAssignments: SabcreatorRoleAssignmentDoc[];
}

export function RolesEditorClient({ app, initialRoles, initialAssignments }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    initialRoles[0]?._id ?? null,
  );
  const router = useRouter();
  const selected = roles.find((r) => r._id === selectedRoleId) ?? null;
  const [pending, startTransition] = useTransition();

  // Inline form for "create new role"
  const [newName, setNewName] = useState('');
  const handleCreate = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorRole({ appId: app._id, name: newName.trim() });
        setRoles((p) => [res.entity, ...p]);
        setSelectedRoleId(res.entity._id);
        setNewName('');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createRole failed', err);
      }
    });
  };

  // Inline form for assignment
  const [assignUserId, setAssignUserId] = useState('');
  const handleAssign = () => {
    if (!selectedRoleId || !assignUserId.trim()) return;
    startTransition(async () => {
      try {
        const res = await assignSabcreatorRole(
          app._id,
          assignUserId.trim(),
          selectedRoleId,
        );
        setAssignments((p) => [res.entity, ...p.filter((a) => a._id !== res.entity._id)]);
        setAssignUserId('');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] assign failed', err);
      }
    });
  };

  const handleUnassign = (id: string) => {
    startTransition(async () => {
      try {
        await unassignSabcreatorRole(id, app._id);
        setAssignments((p) => p.filter((a) => a._id !== id));
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] unassign failed', err);
      }
    });
  };

  const updateRule = (
    field: 'recordsCanRead' | 'recordsCanEdit' | 'recordsCanDelete',
    rule: SabcreatorRowLevelRule,
  ) => {
    if (!selected) return;
    startTransition(async () => {
      try {
        const res = await updateSabcreatorRole(selected._id, app._id, {
          [field]: rule,
        });
        setRoles((p) => p.map((r) => (r._id === res._id ? res : r)));
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] updateRole failed', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <div>
          <ZoruPageTitle>Roles & access</ZoruPageTitle>
          <ZoruPageDescription>
            {app.name} — row-level security + per-user assignments.
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sabcreator/${app._id}/builder`}>
              Back to builder
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid grid-cols-[260px_1fr] gap-4 px-6 pb-10 flex-1">
        <aside>
          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Role name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button size="icon" onClick={handleCreate} disabled={pending || !newName.trim()}>
                <Plus className="size-4" />
              </Button>
            </div>
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(r._id)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-sm text-left ${
                      selectedRoleId === r._id
                        ? 'bg-zoru-ink/10 text-zoru-ink font-medium'
                        : 'hover:bg-zoru-surface-2'
                    }`}
                  >
                    <span>{r.name}</span>
                    <Badge variant="outline" className="shrink-0">
                      {assignments.filter((a) => a.roleId === r._id).length}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>

        <main className="space-y-4">
          {selected ? (
            <>
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Row-level security</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <RuleEditor
                    label="Can read"
                    value={selected.recordsCanRead}
                    onChange={(r) => updateRule('recordsCanRead', r)}
                  />
                  <RuleEditor
                    label="Can edit"
                    value={selected.recordsCanEdit}
                    onChange={(r) => updateRule('recordsCanEdit', r)}
                  />
                  <RuleEditor
                    label="Can delete"
                    value={selected.recordsCanDelete}
                    onChange={(r) => updateRule('recordsCanDelete', r)}
                  />
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Assigned users</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    placeholder="User _id to assign"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                  />
                  <Button onClick={handleAssign} disabled={pending || !assignUserId.trim()}>
                    <UserPlus className="size-4" /> Assign
                  </Button>
                </div>
                <ul className="divide-y">
                  {assignments
                    .filter((a) => a.roleId === selected._id)
                    .map((a) => (
                      <li
                        key={a._id}
                        className="py-2 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium">{a.assigneeUserId}</div>
                          <div className="text-xs text-zoru-ink-muted">
                            assigned {new Date(a.assignedAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnassign(a._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                </ul>
              </Card>
            </>
          ) : (
            <EmptyState
              title="No role selected"
              description="Create a role on the left to start editing access rules."
            />
          )}
        </main>
      </div>
    </div>
  );
}

function RuleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SabcreatorRowLevelRule;
  onChange: (r: SabcreatorRowLevelRule) => void;
}) {
  const [draftCondition, setDraftCondition] = useState(
    JSON.stringify(value.condition ?? {}, null, 2),
  );
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value.rule}
        onValueChange={(v) =>
          onChange({ ...value, rule: v as SabcreatorRowLevelRuleKind })
        }
      >
        <ZoruSelectTrigger>
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          <ZoruSelectItem value="own">Own records</ZoruSelectItem>
          <ZoruSelectItem value="all">All records</ZoruSelectItem>
          <ZoruSelectItem value="conditional">Conditional</ZoruSelectItem>
        </ZoruSelectContent>
      </Select>
      {value.rule === 'conditional' ? (
        <div className="space-y-1">
          <Textarea
            rows={4}
            value={draftCondition}
            onChange={(e) => setDraftCondition(e.target.value)}
            onBlur={() => {
              try {
                const parsed = JSON.parse(draftCondition);
                onChange({
                  ...value,
                  condition:
                    parsed && typeof parsed === 'object' ? parsed : {},
                });
              } catch {
                // ignore until valid
              }
            }}
            placeholder='{"fieldOwnerId": "$user._id"}'
          />
          <p className="text-xs text-zoru-ink-muted">
            JSON predicate evaluated server-side. A visual rule builder is on the roadmap.
          </p>
        </div>
      ) : null}
    </div>
  );
}
