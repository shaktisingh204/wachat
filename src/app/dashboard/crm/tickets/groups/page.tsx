'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Edit,
  LifeBuoy,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Ticket Groups — settings-style list (mirrors the Account Groups page).
 *
 * Inline-create / edit dialog with parent-group selector (populated from
 * the same list), default-assignee + default-SLA ObjectId text inputs
 * (no embedded picker — see "Gaps" in the implementation report), color
 * + icon, description, and active toggle. Search + status filter on top.
 *
 * Reads/writes route through `crm-ticket-groups.actions.ts`, which is a
 * thin shim over the Rust BFF at `/v1/crm/ticket-groups`.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
  deleteTicketGroup,
  getTicketGroups,
  saveTicketGroup,
  type SaveTicketGroupState,
} from '@/app/actions/crm-ticket-groups.actions';
import type {
  CrmTicketGroupDoc,
  CrmTicketGroupStatus,
} from '@/lib/rust-client/crm-ticket-groups';

type StatusFilter = 'all' | CrmTicketGroupStatus;

const saveInitialState: SaveTicketGroupState = {};

const STATUS_TONE: Record<CrmTicketGroupStatus, StatusTone> = {
  active: 'green',
  archived: 'neutral',
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isEditing ? 'Save changes' : 'Create group'}
    </ZoruButton>
  );
}

function TicketGroupDialog({
  isOpen,
  onOpenChange,
  onSave,
  initialData,
  parentOptions,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  initialData: CrmTicketGroupDoc | null;
  parentOptions: CrmTicketGroupDoc[];
}) {
  const isEditing = !!initialData;
  const [state, formAction] = useActionState(saveTicketGroup, saveInitialState);
  const { toast } = useZoruToast();

  const [isActive, setIsActive] = React.useState<boolean>(
    initialData?.isActive ?? true,
  );
  const [parentGroupId, setParentGroupId] = React.useState<string>(
    initialData?.parentGroupId ?? '',
  );
  const [status, setStatus] = React.useState<CrmTicketGroupStatus>(
    initialData?.status ?? 'active',
  );
  const [defaultAssigneeId, setDefaultAssigneeId] = React.useState<string>(
    initialData?.defaultAssigneeId ?? '',
  );
  const [defaultSlaId, setDefaultSlaId] = React.useState<string>(
    initialData?.defaultSlaId ?? '',
  );
  const [color, setColor] = React.useState<string>(initialData?.color ?? '#0EA5E9');
  const [icon, setIcon] = React.useState<string>(initialData?.icon ?? '');

  React.useEffect(() => {
    if (!isOpen) return;
    setIsActive(initialData?.isActive ?? true);
    setParentGroupId(initialData?.parentGroupId ?? '');
    setStatus(initialData?.status ?? 'active');
    setDefaultAssigneeId(initialData?.defaultAssigneeId ?? '');
    setDefaultSlaId(initialData?.defaultSlaId ?? '');
    setColor(initialData?.color ?? '#0EA5E9');
    setIcon(initialData?.icon ?? '');
  }, [initialData, isOpen]);

  React.useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
    // We only want to react to a fresh server-action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Don't let a group be its own parent.
  const filteredParentOptions = React.useMemo(
    () =>
      parentOptions.filter((g) => !initialData || g._id !== initialData._id),
    [parentOptions, initialData],
  );

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <form action={formAction}>
          {isEditing ? (
            <input type="hidden" name="_id" value={String(initialData!._id)} />
          ) : null}
          {/* ZoruSwitch doesn't post a value — mirror it into a hidden input */}
          <input
            type="hidden"
            name="isActive"
            value={isActive ? 'true' : 'false'}
          />
          <input type="hidden" name="parentGroupId" value={parentGroupId} />
          <input type="hidden" name="defaultAssigneeId" value={defaultAssigneeId} />
          <input type="hidden" name="defaultSlaId" value={defaultSlaId} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="icon" value={icon} />
          {isEditing ? (
            <input type="hidden" name="status" value={status} />
          ) : null}

          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? 'Edit' : 'Create new'} ticket group
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="name">Name *</ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                placeholder="e.g. Billing Issues"
                required
                defaultValue={initialData?.name}
              />
            </div>

            <div className="space-y-2">
              <ZoruLabel htmlFor="description">Description</ZoruLabel>
              <ZoruTextarea
                id="description"
                name="description"
                placeholder="What kinds of tickets land in this group?"
                rows={2}
                defaultValue={initialData?.description ?? ''}
              />
            </div>

            <div className="space-y-2">
              <ZoruLabel htmlFor="parentGroupId">Parent group</ZoruLabel>
              <ZoruSelect
                value={parentGroupId || '__none__'}
                onValueChange={(v) =>
                  setParentGroupId(v === '__none__' ? '' : v)
                }
              >
                <ZoruSelectTrigger id="parentGroupId">
                  <ZoruSelectValue placeholder="No parent" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— No parent —</ZoruSelectItem>
                  {filteredParentOptions.map((g) => (
                    <ZoruSelectItem key={g._id} value={g._id}>
                      {g.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <ZoruLabel>Default assignee</ZoruLabel>
                <EntityFormField
                  entity="user"
                  name="__defaultAssigneeId_picker"
                  initialId={defaultAssigneeId || null}
                  onChange={(id) => setDefaultAssigneeId(id ?? '')}
                  placeholder="Pick a user…"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel>Default SLA</ZoruLabel>
                <EntityFormField
                  entity="sla"
                  name="__defaultSlaId_picker"
                  initialId={defaultSlaId || null}
                  onChange={(id) => setDefaultSlaId(id ?? '')}
                  placeholder="Pick an SLA…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <ZoruLabel>Color</ZoruLabel>
                <ZoruColorPicker value={color} onChange={setColor} />
              </div>
              <div className="space-y-2">
                <ZoruLabel>Icon</ZoruLabel>
                <ZoruIconPicker value={icon} onChange={setIcon} color={color} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex flex-col">
                <ZoruLabel htmlFor="isActiveToggle">Active</ZoruLabel>
                <span className="text-xs text-muted-foreground">
                  Inactive groups are hidden from ticket pickers.
                </span>
              </div>
              <ZoruSwitch
                id="isActiveToggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <ZoruLabel htmlFor="statusSelect">Status</ZoruLabel>
                <ZoruSelect
                  value={status}
                  onValueChange={(v) => setStatus(v as CrmTicketGroupStatus)}
                >
                  <ZoruSelectTrigger id="statusSelect">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            ) : null}
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function ColorSwatch({ color }: { color?: string }) {
  if (!color) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded-full border border-border"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono text-xs text-foreground">{color}</span>
    </span>
  );
}

export default function TicketGroupsPage() {
  const [groups, setGroups] = React.useState<CrmTicketGroupDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<CrmTicketGroupDoc | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmTicketGroupDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getTicketGroups({ status: 'all', limit: 200 });
    if (res.error) {
      toast({
        title: 'Failed to load',
        description: res.error,
        variant: 'destructive',
      });
    }
    setGroups(res.groups);
    setIsLoading(false);
  }, [toast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Map id → group for quick parent-name lookups in the table.
  const byId = React.useMemo(() => {
    const map = new Map<string, CrmTicketGroupDoc>();
    for (const g of groups) map.set(String(g._id), g);
    return map;
  }, [groups]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${g.name} ${g.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [groups, search, statusFilter]);

  const handleOpenDialog = (group: CrmTicketGroupDoc | null) => {
    setEditing(group);
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = String(pendingDelete._id);
    startDeleteTransition(async () => {
      const result = await deleteTicketGroup(id);
      if (result.success) {
        toast({ title: 'Group deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <>
      <TicketGroupDialog
        // Re-mount on edit-target change so useActionState resets cleanly.
        key={editing ? String(editing._id) : 'create'}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={refresh}
        initialData={editing}
        parentOptions={groups}
      />

      <div className="flex w-full flex-col gap-6">
        <EntityListShell
          title="Ticket Groups"
          subtitle="Organize support tickets by team, product, or domain."
          primaryAction={
            <ZoruButton onClick={() => handleOpenDialog(null)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Group
            </ZoruButton>
          }
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search groups…',
          }}
          filters={
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          }
          loading={isLoading && groups.length === 0}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-border hover:bg-transparent">
                  <ZoruTableHead className="text-muted-foreground">
                    Name
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Parent Group
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Default Assignee
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Default SLA
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Color
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground text-right">
                    Tickets
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Status
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground text-right">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  <ZoruTableRow className="border-border">
                    <ZoruTableCell colSpan={8} className="h-24 text-center">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : filtered.length === 0 ? (
                  <ZoruTableRow className="border-border">
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No ticket groups match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((g) => {
                    const parent = g.parentGroupId
                      ? byId.get(g.parentGroupId)
                      : null;
                    return (
                      <ZoruTableRow
                        key={String(g._id)}
                        className="border-border"
                      >
                        <ZoruTableCell className="font-medium text-foreground">
                          <div className="flex flex-col">
                            <span>{g.name}</span>
                            {g.description ? (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {g.description}
                              </span>
                            ) : null}
                          </div>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-foreground">
                          {parent ? (
                            parent.name
                          ) : g.parentGroupId ? (
                            <span
                              className="font-mono text-xs text-muted-foreground"
                              title={g.parentGroupId}
                            >
                              {g.parentGroupId.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {g.defaultAssigneeId ? (
                            <span
                              className="font-mono text-xs text-foreground"
                              title={g.defaultAssigneeId}
                            >
                              {g.defaultAssigneeId.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {g.defaultSlaId ? (
                            <span
                              className="font-mono text-xs text-foreground"
                              title={g.defaultSlaId}
                            >
                              {g.defaultSlaId.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <ColorSwatch color={g.color} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-foreground">
                          {g.ticketsCount ?? 0}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={g.status}
                            tone={STATUS_TONE[g.status] ?? 'neutral'}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(g)}
                            aria-label="Edit group"
                          >
                            <Edit className="h-4 w-4" />
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(g)}
                            aria-label="Delete group"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </ZoruButton>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </EntityListShell>
      </div>

      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete ticket group?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDelete?.name}&rdquo; will affect{' '}
              {pendingDelete?.ticketsCount ?? 0} ticket(s) currently in this
              group. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
