'use client';

import {
  useActionState,
  useCallback,
  useEffect,
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
import type { HrTicket } from '@/lib/hr-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Ticket = HrTicket & { _id: string };

const STATUS_COLUMNS: {
  status: Ticket['status'];
  label: string;
  tone: 'amber' | 'blue' | 'neutral' | 'green';
}[] = [
  { status: 'open', label: 'Open', tone: 'amber' },
  { status: 'in-progress', label: 'In Progress', tone: 'blue' },
  { status: 'waiting', label: 'Waiting', tone: 'neutral' },
  { status: 'resolved', label: 'Resolved', tone: 'green' },
  { status: 'closed', label: 'Closed', tone: 'neutral' },
];

const STATUS_TONES: Record<string, 'amber' | 'blue' | 'neutral' | 'green'> = {
  open: 'amber',
  'in-progress': 'blue',
  waiting: 'neutral',
  resolved: 'green',
  closed: 'neutral',
};

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export default function TicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [saveState, saveFormAction, isSaving] = useActionState(saveTicket, {
    message: '',
    error: '',
  } as any);

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
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Ticket
          </ClayButton>
        }
      />

      <Tabs defaultValue="board">
        <TabsList className="rounded-full bg-clay-surface-2 p-1">
          <TabsTrigger
            value="board"
            className="rounded-full data-[state=active]:bg-clay-surface data-[state=active]:text-clay-ink"
          >
            Board
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="rounded-full data-[state=active]:bg-clay-surface data-[state=active]:text-clay-ink"
          >
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {isLoading && tickets.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {STATUS_COLUMNS.map((c) => (
                <Skeleton key={c.status} className="h-[50vh] rounded-clay-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {STATUS_COLUMNS.map((col) => {
                const colTickets = tickets.filter((t) => t.status === col.status);
                return (
                  <ClayCard
                    key={col.status}
                    variant="soft"
                    className="flex flex-col"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <ClayBadge tone={col.tone} dot>
                        {col.label}
                      </ClayBadge>
                      <span className="text-[11.5px] text-clay-ink-muted">
                        {colTickets.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colTickets.length === 0 ? (
                        <div className="rounded-clay-md border border-dashed border-clay-border p-4 text-center text-[12px] text-clay-ink-muted">
                          No tickets
                        </div>
                      ) : (
                        colTickets.map((ticket) => (
                          <ClayCard
                            key={ticket._id}
                            padded={false}
                            className="p-3"
                          >
                            <p className="text-[13px] font-medium text-clay-ink">
                              {ticket.subject}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-clay-ink-muted">
                              {ticket.clientName ? (
                                <span>{ticket.clientName}</span>
                              ) : null}
                              <ClayBadge
                                tone={PRIORITY_TONES[ticket.priority] || 'neutral'}
                                dot
                              >
                                {ticket.priority}
                              </ClayBadge>
                              {ticket.assigneeName ? (
                                <span className="truncate">
                                  → {ticket.assigneeName}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2">
                              <Select
                                value={ticket.status}
                                onValueChange={(v) =>
                                  changeStatus(ticket._id, v as Ticket['status'])
                                }
                              >
                                <SelectTrigger className="h-8 rounded-full border-clay-border bg-clay-surface text-[11.5px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_COLUMNS.map((c) => (
                                    <SelectItem key={c.status} value={c.status}>
                                      {c.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </ClayCard>
                        ))
                      )}
                    </div>
                  </ClayCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <ClayCard>
            <div className="overflow-x-auto rounded-clay-md border border-clay-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-clay-border hover:bg-transparent">
                    <TableHead className="text-clay-ink-muted">Subject</TableHead>
                    <TableHead className="text-clay-ink-muted">Client</TableHead>
                    <TableHead className="text-clay-ink-muted">Priority</TableHead>
                    <TableHead className="text-clay-ink-muted">Status</TableHead>
                    <TableHead className="text-clay-ink-muted">Assignee</TableHead>
                    <TableHead className="w-[120px] text-right text-clay-ink-muted">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && tickets.length === 0 ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i} className="border-clay-border">
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : tickets.length === 0 ? (
                    <TableRow className="border-clay-border">
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-[13px] text-clay-ink-muted"
                      >
                        No tickets yet — click Add Ticket to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow key={ticket._id} className="border-clay-border">
                        <TableCell className="text-[13px] font-medium text-clay-ink">
                          {ticket.subject}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {ticket.clientName || '—'}
                        </TableCell>
                        <TableCell>
                          <ClayBadge
                            tone={PRIORITY_TONES[ticket.priority] || 'neutral'}
                            dot
                          >
                            {ticket.priority}
                          </ClayBadge>
                        </TableCell>
                        <TableCell>
                          <ClayBadge
                            tone={STATUS_TONES[ticket.status] || 'neutral'}
                            dot
                          >
                            {ticket.status}
                          </ClayBadge>
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {ticket.assigneeName || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(ticket);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(ticket._id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ClayCard>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Ticket' : 'Add Ticket'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-clay-ink">
                  Subject <span className="text-clay-red">*</span>
                </Label>
                <Input
                  name="subject"
                  required
                  defaultValue={editing?.subject || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Client Name</Label>
                <Input
                  name="clientName"
                  defaultValue={editing?.clientName || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Requester Email</Label>
                <Input
                  type="email"
                  name="requesterEmail"
                  defaultValue={editing?.requesterEmail || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">
                  Priority <span className="text-clay-red">*</span>
                </Label>
                <Select
                  name="priority"
                  defaultValue={editing?.priority || 'medium'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">
                  Status <span className="text-clay-red">*</span>
                </Label>
                <Select
                  name="status"
                  defaultValue={editing?.status || 'open'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">Assignee</Label>
                <Input
                  name="assigneeName"
                  defaultValue={editing?.assigneeName || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Category</Label>
                <Input
                  name="category"
                  defaultValue={editing?.category || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-clay-ink">Description</Label>
                <Textarea
                  name="description"
                  rows={4}
                  defaultValue={editing?.description || ''}
                  className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null
                }
              >
                Save
              </ClayButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">
              Delete ticket?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
