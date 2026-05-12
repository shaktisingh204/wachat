'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  LifeBuoy,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import {
  getTickets,
  saveTicket,
  updateTicketStatus,
  deleteTicket,
} from '@/app/actions/crm-services.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { HrTicket } from '@/lib/hr-types';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';

type Ticket = HrTicket & { _id: string };

type StatusVariant = 'success' | 'ghost' | 'warning' | 'danger';

const STATUS_COLUMNS: {
  status: Ticket['status'];
  label: string;
  variant: StatusVariant;
}[] = [
  { status: 'open', label: 'Open', variant: 'warning' },
  { status: 'in-progress', label: 'In Progress', variant: 'success' },
  { status: 'waiting', label: 'Waiting', variant: 'ghost' },
  { status: 'resolved', label: 'Resolved', variant: 'success' },
  { status: 'closed', label: 'Closed', variant: 'ghost' },
];

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  open: 'warning',
  'in-progress': 'success',
  waiting: 'ghost',
  resolved: 'success',
  closed: 'ghost',
};

const PRIORITY_VARIANTS: Record<string, StatusVariant> = {
  low: 'ghost',
  medium: 'success',
  high: 'warning',
  urgent: 'danger',
};

type ViewTab = 'board' | 'list';

export default function TicketsPage() {
  const { toast } = useZoruToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTab>('board');

  const [saveState, saveFormAction, isSaving] = useActionState(saveTicket, {
    message: '',
    error: '',
  } as any);

  // Custom-field definitions configured in CRM Settings → Custom Fields
  // for entity=ticket. Loaded once on first dialog open.
  const [customFields, setCustomFields] = useState<WsCustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >({});
  const customFieldsLoadedRef = useRef(false);

  useEffect(() => {
    if (!dialogOpen) return;
    if (customFieldsLoadedRef.current) return;
    customFieldsLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const defs = await getCustomFieldsFor('ticket');
        if (!cancelled) setCustomFields((defs as WsCustomField[]) ?? []);
      } catch {
        if (!cancelled) setCustomFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  // Reseed custom-field values whenever the dialog opens for a different
  // ticket. `editing.customFields` is the storage shape applied by
  // `applyCustomFieldsToEntity` — keyed by `WsCustomField.name`.
  useEffect(() => {
    if (!dialogOpen) return;
    const seed = (editing as Ticket & {
      customFields?: Record<string, CustomFieldValue>;
    } | null)?.customFields;
    setCustomFieldValues(seed ?? {});
  }, [dialogOpen, editing]);

  const handleCustomFieldChange = useCallback(
    (slug: string, next: CustomFieldValue) => {
      setCustomFieldValues((prev) => ({ ...prev, [slug]: next }));
    },
    [],
  );

  // Inject the JSON-encoded customFields blob into FormData under the
  // `customFields` key. `saveTicket` parses + persists via
  // `applyCustomFieldsToEntity('ticket', insertedId, parsed)`.
  const handleSaveAction = useCallback(
    (formData: FormData) => {
      formData.set('customFields', JSON.stringify(customFieldValues));
      saveFormAction(formData);
    },
    [saveFormAction, customFieldValues],
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getTickets();
      setTickets((list as Ticket[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTicket(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Ticket removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const changeStatus = async (id: string, status: Ticket['status']) => {
    const prev = tickets;
    setTickets((curr) =>
      curr.map((t) => (t._id === id ? { ...t, status } : t)),
    );
    const res = await updateTicketStatus(id, status);
    if (!res.success) {
      setTickets(prev);
      toast({
        title: 'Error',
        description: res.error || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Tickets"
        subtitle="Customer support requests and issue tracking."
        icon={LifeBuoy}
        actions={
          <ZoruButton
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Ticket
          </ZoruButton>
        }
      />

      <div>
        <div className="flex w-fit gap-1 rounded-full border border-zoru-line bg-zoru-surface-2 p-1">
          {(['board', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-colors capitalize',
                view === v
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {view === 'board' && (
          <div className="mt-4">
            {isLoading && tickets.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {STATUS_COLUMNS.map((c) => (
                  <ZoruSkeleton key={c.status} className="h-[50vh] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {STATUS_COLUMNS.map((col) => {
                  const colTickets = tickets.filter(
                    (t) => t.status === col.status,
                  );
                  return (
                    <ZoruCard key={col.status} className="flex flex-col p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <ZoruBadge variant={col.variant}>{col.label}</ZoruBadge>
                        <span className="text-[11.5px] text-zoru-ink-muted">
                          {colTickets.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {colTickets.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-zoru-line p-4 text-center text-[12px] text-zoru-ink-muted">
                            No tickets
                          </div>
                        ) : (
                          colTickets.map((ticket) => (
                            <ZoruCard key={ticket._id} className="p-3">
                              <p className="text-[13px] font-medium text-zoru-ink">
                                {ticket.subject}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-zoru-ink-muted">
                                {ticket.clientName ? (
                                  <span>{ticket.clientName}</span>
                                ) : null}
                                <ZoruBadge
                                  variant={
                                    PRIORITY_VARIANTS[ticket.priority] ||
                                    'ghost'
                                  }
                                >
                                  {ticket.priority}
                                </ZoruBadge>
                                {ticket.assigneeName ? (
                                  <span className="truncate">
                                    → {ticket.assigneeName}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2">
                                <ZoruSelect
                                  value={ticket.status}
                                  onValueChange={(v) =>
                                    changeStatus(
                                      ticket._id,
                                      v as Ticket['status'],
                                    )
                                  }
                                >
                                  <ZoruSelectTrigger className="h-8 rounded-full border-zoru-line bg-zoru-bg text-[11.5px]">
                                    <ZoruSelectValue />
                                  </ZoruSelectTrigger>
                                  <ZoruSelectContent>
                                    {STATUS_COLUMNS.map((c) => (
                                      <ZoruSelectItem
                                        key={c.status}
                                        value={c.status}
                                      >
                                        {c.label}
                                      </ZoruSelectItem>
                                    ))}
                                  </ZoruSelectContent>
                                </ZoruSelect>
                              </div>
                            </ZoruCard>
                          ))
                        )}
                      </div>
                    </ZoruCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === 'list' && (
          <div className="mt-4">
            <ZoruCard className="p-6">
              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted">Subject</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Assignee</ZoruTableHead>
                      <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                        Actions
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {isLoading && tickets.length === 0 ? (
                      [...Array(3)].map((_, i) => (
                        <ZoruTableRow key={i} className="border-zoru-line">
                          <ZoruTableCell colSpan={6}>
                            <ZoruSkeleton className="h-8 w-full" />
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    ) : tickets.length === 0 ? (
                      <ZoruTableRow className="border-zoru-line">
                        <ZoruTableCell
                          colSpan={6}
                          className="h-24 text-center text-[13px] text-zoru-ink-muted"
                        >
                          No tickets yet — click Add Ticket to get started.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ) : (
                      tickets.map((ticket) => (
                        <ZoruTableRow key={ticket._id} className="border-zoru-line">
                          <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                            {ticket.subject}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {ticket.clientId ? (
                              <EntityPickerChip
                                entity="client"
                                id={String(ticket.clientId)}
                                fallback={ticket.clientName}
                              />
                            ) : (
                              ticket.clientName || '—'
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge
                              variant={
                                PRIORITY_VARIANTS[ticket.priority] || 'ghost'
                              }
                            >
                              {ticket.priority}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge
                              variant={
                                STATUS_VARIANTS[ticket.status] || 'ghost'
                              }
                            >
                              {ticket.status}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {ticket.assigneeId ? (
                              <EntityPickerChip
                                entity="user"
                                id={String(ticket.assigneeId)}
                                fallback={ticket.assigneeName}
                              />
                            ) : (
                              ticket.assigneeName || '—'
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(ticket);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(ticket._id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    )}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            </ZoruCard>
          </div>
        )}
      </div>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {editing ? 'Edit Ticket' : 'Add Ticket'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Fill in the details below.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={handleSaveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <ZoruLabel className="text-zoru-ink">
                  Subject <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  name="subject"
                  required
                  defaultValue={editing?.subject || ''}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">Client</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="client"
                    name="clientId"
                    dualWriteName="clientName"
                    initialId={editing?.clientId ? String(editing.clientId) : null}
                    initialLabel={editing?.clientName}
                    allowCreate
                  />
                </div>
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">Requester Email</ZoruLabel>
                <ZoruInput
                  type="email"
                  name="requesterEmail"
                  defaultValue={editing?.requesterEmail || ''}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">
                  Priority <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  name="priority"
                  defaultValue={editing?.priority || 'medium'}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="low">Low</ZoruSelectItem>
                    <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                    <ZoruSelectItem value="high">High</ZoruSelectItem>
                    <ZoruSelectItem value="urgent">Urgent</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">
                  Status <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  name="status"
                  defaultValue={editing?.status || 'open'}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="open">Open</ZoruSelectItem>
                    <ZoruSelectItem value="in-progress">In Progress</ZoruSelectItem>
                    <ZoruSelectItem value="waiting">Waiting</ZoruSelectItem>
                    <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                    <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">Assignee</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="user"
                    name="assigneeId"
                    dualWriteName="assigneeName"
                    initialId={editing?.assigneeId ? String(editing.assigneeId) : null}
                    initialLabel={editing?.assigneeName}
                  />
                </div>
              </div>
              <div>
                <ZoruLabel className="text-zoru-ink">Category</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="category"
                    name="categoryId"
                    dualWriteName="category"
                    initialId={editing?.categoryId ? String(editing.categoryId) : null}
                    initialLabel={editing?.category}
                    allowCreate
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <ZoruLabel className="text-zoru-ink">Description</ZoruLabel>
                <ZoruTextarea
                  name="description"
                  rows={4}
                  defaultValue={editing?.description || ''}
                  className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>

            {customFields.length > 0 ? (
              <div className="space-y-3 border-t border-zoru-line pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                  Custom Fields
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {customFields.map((f) => (
                    <CustomFieldInput
                      key={String(f._id ?? f.name)}
                      field={f}
                      value={customFieldValues[f.name]}
                      onChange={(next) =>
                        handleCustomFieldChange(f.name, next)
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <ZoruDialogFooter className="gap-2">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null}
                Save
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">
              Delete ticket?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
