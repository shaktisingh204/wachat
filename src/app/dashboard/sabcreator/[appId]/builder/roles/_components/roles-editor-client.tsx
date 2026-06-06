'use client';

/**
 * Roles, row-level-security, and user-assignment editor.
 *
 * The condition input is a plain JSON textarea. A true visual rule builder is
 * deferred (TODO marker noted in the action layer).
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus, ShieldCheck } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();

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
        toast.success('Role created');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createRole failed', err);
        toast.error('Could not create the role');
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
        toast.success('User assigned');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] assign failed', err);
        toast.error('Could not assign the user');
      }
    });
  };

  const handleUnassign = (id: string) => {
    startTransition(async () => {
      try {
        await unassignSabcreatorRole(id, app._id);
        setAssignments((p) => p.filter((a) => a._id !== id));
        toast.success('User unassigned');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] unassign failed', err);
        toast.error('Could not unassign the user');
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
        toast.success('Access rule saved');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] updateRole failed', err);
        toast.error('Could not save the access rule');
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Roles and access</PageTitle>
          <PageDescription>
            {app.name}. Row-level security and per-user assignments.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sabcreator/${app._id}/builder`}>
              Back to builder
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-[260px_1fr] gap-4 px-6 pb-10 flex-1">
        <aside>
          <Card padding="sm" className="space-y-3">
            <div className="flex items-end gap-2">
              <Field label="New role" className="flex-1">
                <Input
                  placeholder="Role name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </Field>
              <IconButton
                label="Create role"
                icon={Plus}
                variant="primary"
                onClick={handleCreate}
                disabled={pending || !newName.trim()}
              />
            </div>
            <ul className="space-y-1">
              {roles.map((r) => {
                const isActive = selectedRoleId === r._id;
                return (
                  <li key={r._id}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      block
                      onClick={() => setSelectedRoleId(r._id)}
                      aria-pressed={isActive}
                      className="justify-between"
                    >
                      <span>{r.name}</span>
                      <Badge variant="outline" className="shrink-0">
                        {assignments.filter((a) => a.roleId === r._id).length}
                      </Badge>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        <main className="space-y-4">
          {selected ? (
            <>
              <Card padding="md">
                <CardHeader>
                  <CardTitle>Row-level security</CardTitle>
                </CardHeader>
                <CardBody>
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
                </CardBody>
              </Card>

              <Card padding="md">
                <CardHeader>
                  <CardTitle>Assigned users</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="flex items-end gap-2 mb-4">
                    <Field label="Assign user" className="flex-1">
                      <Input
                        placeholder="User _id to assign"
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                      />
                    </Field>
                    <Button
                      variant="primary"
                      iconLeft={UserPlus}
                      onClick={handleAssign}
                      disabled={pending || !assignUserId.trim()}
                    >
                      Assign
                    </Button>
                  </div>
                  <ul className="divide-y divide-[var(--st-border)]">
                    {assignments
                      .filter((a) => a.roleId === selected._id)
                      .map((a) => (
                        <li
                          key={a._id}
                          className="py-2 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-medium text-[var(--st-text)]">
                              {a.assigneeUserId}
                            </div>
                            <div className="text-xs text-[var(--st-text-secondary)]">
                              assigned {new Date(a.assignedAt).toLocaleString()}
                            </div>
                          </div>
                          <IconButton
                            label="Unassign user"
                            icon={Trash2}
                            variant="ghost"
                            onClick={() => handleUnassign(a._id)}
                          />
                        </li>
                      ))}
                  </ul>
                </CardBody>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={ShieldCheck}
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
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="own">Own records</SelectItem>
          <SelectItem value="all">All records</SelectItem>
          <SelectItem value="conditional">Conditional</SelectItem>
        </SelectContent>
      </Select>
      {value.rule === 'conditional' ? (
        <Field help="JSON predicate evaluated server-side. A visual rule builder is on the roadmap.">
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
        </Field>
      ) : null}
    </div>
  );
}
