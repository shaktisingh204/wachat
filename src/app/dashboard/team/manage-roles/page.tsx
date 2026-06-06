'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  SegmentedControl,
  Skeleton,
  StatCard,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import { ShieldCheck, Plus, Save, Trash2, Check, ShieldOff } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import {
  saveRolePermissions,
  saveRole,
  deleteRole,
} from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';
import { moduleCategories } from '@/lib/permission-modules';

const initialState = { message: undefined, error: undefined } as {
  message?: string;
  error?: string;
};

const actions = ['view', 'create', 'edit', 'delete'] as const;

const permissionCategories = Object.entries(moduleCategories).reduce((acc, [label, modules]) => {
  acc[label] = {
    label,
    modules: modules.map((m) => {
      const name = m
        .split(/[_.]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return { id: m, name };
    }),
  };
  return acc;
}, {} as Record<string, { label: string; modules: Array<{ id: string; name: string }> }>);

/* Sticky save bar */

function SaveBar() {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]/95 p-3 shadow-[var(--st-shadow-md)] backdrop-blur">
      <p className="pl-2 text-[12.5px] text-[var(--st-text-secondary)]">
        Toggle permissions for every role, then save to sync all members.
      </p>
      <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
        {pending ? 'Saving' : 'Save permissions'}
      </Button>
    </div>
  );
}

/* Skeleton */

function PageSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Skeleton width={240} height={20} />
      <Skeleton width={320} height={40} />
      <Skeleton width="100%" height={420} radius={16} />
    </div>
  );
}

/* Add role dialog */

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleAddRole = () => {
    if (!roleName.trim()) {
      toast.error('Role name cannot be empty.');
      return;
    }
    startTransition(async () => {
      const result = await saveRole({ id: '', name: roleName, permissions: {} });
      if (result.success) {
        toast.success('New role created.');
        onRoleAdded();
        setOpen(false);
        setRoleName('');
      } else {
        toast.error(result.error ?? 'Could not create the role.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" iconLeft={Plus}>
          New role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new role</DialogTitle>
          <DialogDescription>
            Give the role a name. You can configure permissions once it appears in the list.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Field label="Role name">
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Marketing Manager"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddRole} loading={isPending}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Delete role button */

function DeleteRoleButton({
  role,
  onRoleDeleted,
}: {
  role: { id: string; name: string };
  onRoleDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (role.id === 'agent') return null;

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.success) {
        toast.success('Role deleted');
        onRoleDeleted();
      } else {
        toast.error(result.error ?? 'Could not delete the role.');
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <IconButton
          variant="outline"
          icon={Trash2}
          label={`Delete ${role.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete role?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the "{role.name}" role. Members assigned to it will lose these
            permissions immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* Role card (accordion section) */

type RolePerms = Record<string, Partial<Record<(typeof actions)[number], boolean>>>;
type RoleRow = { id: string; name: string; permissions: RolePerms };

function RoleCard({ role, onRoleDeleted }: { role: RoleRow; onRoleDeleted: () => void }) {
  const categoryKeys = Object.keys(permissionCategories);
  const [activeCategory, setActiveCategory] = useState<string>(categoryKeys[0]);
  const [perms, setPerms] = useState<RolePerms>(role.permissions || {});

  const enabledCount = useMemo(() => {
    let n = 0;
    for (const mod of Object.values(perms)) {
      if (!mod) continue;
      for (const a of actions) if (mod[a]) n += 1;
    }
    return n;
  }, [perms]);

  const segments = useMemo(
    () =>
      Object.entries(permissionCategories).map(([key, cat]) => ({
        value: key,
        label: cat.label,
      })),
    [],
  );

  const cat = permissionCategories[activeCategory];

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 pr-4">
        <AccordionTrigger className="flex-1">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col text-left">
              <span className="text-[14px] text-[var(--st-text)]">{role.name}</span>
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                {enabledCount} permission{enabledCount === 1 ? '' : 's'} granted
              </span>
            </span>
            {role.id === 'agent' && (
              <Badge tone="neutral" kind="outline">
                System
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <DeleteRoleButton role={role} onRoleDeleted={onRoleDeleted} />
      </div>

      <AccordionContent>
        <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)] p-5">
          <input type="hidden" name="roleId" value={role.id} />
          <div className="mb-4 overflow-x-auto">
            <SegmentedControl
              items={segments}
              value={activeCategory}
              onChange={setActiveCategory}
              aria-label="Permission category"
            />
          </div>

          {cat && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] text-[var(--st-text)]">{cat.label} permissions</h3>
                <Badge tone="neutral" kind="soft">
                  {cat.modules.length} modules
                </Badge>
              </div>
              <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                <Table density="compact" hover>
                  <THead>
                    <Tr>
                      <Th>Module</Th>
                      {actions.map((a) => {
                        const allChecked = cat.modules.every((m) => perms[m.id]?.[a]);
                        const someChecked = cat.modules.some((m) => perms[m.id]?.[a]);
                        return (
                          <Th key={a} align="center" width={88}>
                            <span className="inline-flex items-center gap-1.5">
                              <Checkbox
                                size="sm"
                                checked={allChecked}
                                indeterminate={!allChecked && someChecked}
                                aria-label={`Toggle ${a} for all ${cat.label} modules`}
                                onChange={(e) => {
                                  const newVal = e.target.checked;
                                  setPerms((prev) => {
                                    const next = { ...prev };
                                    cat.modules.forEach((m) => {
                                      next[m.id] = { ...(next[m.id] || {}), [a]: newVal };
                                    });
                                    return next;
                                  });
                                }}
                              />
                              <span className="capitalize">{a}</span>
                            </span>
                          </Th>
                        );
                      })}
                    </Tr>
                  </THead>
                  <TBody>
                    {cat.modules.map((mod) => (
                      <Tr key={mod.id}>
                        <Td>{mod.name}</Td>
                        {actions.map((action) => (
                          <Td key={action} align="center">
                            <Checkbox
                              size="sm"
                              name={`${role.id}_${mod.id}_${action}`}
                              checked={perms[mod.id]?.[action] ?? false}
                              aria-label={`${action} ${mod.name}`}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPerms((prev) => ({
                                  ...prev,
                                  [mod.id]: {
                                    ...(prev[mod.id] || {}),
                                    [action]: checked,
                                  },
                                }));
                              }}
                            />
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </Card>
  );
}

/* Page */

export default function ManageRolesPage() {
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [state, formAction] = useActionState(saveRolePermissions, initialState);
  const { toast } = useToast();

  const fetchUser = () => {
    startLoading(async () => {
      const session = await getSession();
      setUser(session?.user || null);
    });
  };

  useEffect(() => {
    fetchUser();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      fetchUser();
    }
    if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (isLoading || !user) {
    return <PageSkeleton />;
  }

  const allRoles: RoleRow[] = [
    { id: 'agent', name: 'Agent', permissions: (user.crm?.permissions as any)?.agent ?? {} },
    ...(((user.crm?.customRoles ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions ?? {},
    }))),
  ];

  const totalGranted = allRoles.reduce((sum, r) => {
    let n = 0;
    for (const mod of Object.values(r.permissions || {})) {
      for (const a of actions) if ((mod as any)?.[a]) n += 1;
    }
    return sum + n;
  }, 0);

  const totalModules = Object.values(permissionCategories).reduce(
    (n, c) => n + c.modules.length,
    0,
  );

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/team">Team</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Roles and permissions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Roles and permissions</PageTitle>
          <PageDescription>
            Define what each role can access and do across every module of the platform.
          </PageDescription>
        </PageHeading>
        <AddRoleDialog onRoleAdded={fetchUser} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Roles" value={allRoles.length} icon={ShieldCheck} />
        <StatCard label="Permissions granted" value={totalGranted} icon={Check} />
        <StatCard label="Modules covered" value={totalModules} icon={ShieldOff} />
      </div>

      <form action={formAction} className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-3">
          {allRoles.length === 0 ? (
            <EmptyState
              icon={ShieldOff}
              title="No roles yet"
              description="Create a role to start assigning module permissions to your team."
            />
          ) : (
            <Accordion type="multiple" defaultValue={[allRoles[0]?.id]} className="flex flex-col gap-3">
              {allRoles.map((role) => (
                <AccordionItem key={role.id} value={role.id} className="border-0">
                  <RoleCard role={role} onRoleDeleted={fetchUser} />
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        <SaveBar />
      </form>

      <Card variant="ghost" className="flex items-start gap-3 bg-[var(--st-bg-muted)]/50">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)] text-[var(--st-bg)]">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[13px] text-[var(--st-text)]">How permissions apply</p>
          <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
            Changes take effect immediately. Members with a role pick up the updated module access on
            their next navigation. System roles (e.g. Agent) cannot be deleted, but their permissions
            can still be tuned per module.
          </p>
        </div>
      </Card>
    </div>
  );
}
