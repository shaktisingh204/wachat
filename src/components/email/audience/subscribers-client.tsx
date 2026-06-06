'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, Search, Upload, Users } from 'lucide-react';
import { Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionCreateEmailSubscriber,
  actionListEmailLists,
  actionListEmailSubscribers,
} from '@/app/actions/email/audience.actions';
import type { EmailListDoc, EmailSubscriberDoc } from '@/lib/rust-client/email-audience';

export function EmailSubscribersClient() {
  const [lists, setLists] = useState<EmailListDoc[]>([]);
  const [subscribers, setSubscribers] = useState<EmailSubscriberDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const limit = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const listsResult = await actionListEmailLists({ limit: 100 });
    if (!listsResult.ok) {
      toast({ title: 'Failed to load lists', description: listsResult.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setLists(listsResult.data.items);

    const subsResult = await actionListEmailSubscribers({
      page,
      limit,
      listId: selectedListId || undefined,
      search: search || undefined,
      status: statusFilter !== 'all' ? (statusFilter as EmailSubscriberDoc['status']) : undefined,
    });
    if (!subsResult.ok) {
      toast({ title: 'Failed to load subscribers', description: subsResult.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setSubscribers(subsResult.data.items);
    setTotal(subsResult.data.total);
    setLoading(false);
  }, [page, selectedListId, search, statusFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Users className="h-6 w-6" /> Subscribers
            </span>
          </PageTitle>
          <PageDescription>Manage every contact across your audience lists.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" disabled>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={lists.length === 0}>
            <Plus className="h-4 w-4" /> Add subscriber
          </Button>
        </PageActions>
      </PageHeader>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Email, first name, last name"
            />
          </div>
        </div>
        <div className="space-y-2 w-[200px]">
          <Label>List</Label>
          <Select value={selectedListId || 'all'} onValueChange={(v) => { setSelectedListId(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All lists" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lists</SelectItem>
              {lists.map((l) => (
                <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 w-[180px]">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="subscribed">Subscribed</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="complained">Complained</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : subscribers.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No subscribers"
          description="Add subscribers manually, import a CSV, or embed a signup form."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Tags</Th>
                <Th>Joined</Th>
              </Tr>
            </THead>
            <TBody>
              {subscribers.map((s) => (
                <Tr key={s._id}>
                  <Td className="font-medium text-[var(--st-text)]">{s.email}</Td>
                  <Td>
                    {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                  </Td>
                  <Td>
                    <Badge variant="outline">{s.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {(s.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                      {(s.tags?.length ?? 0) > 3 ? (
                        <span className="text-xs text-[var(--st-text-secondary)]">+{(s.tags!.length - 3)}</span>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)] text-sm">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--st-text-secondary)]">
            Page {page} of {totalPages} · {total.toLocaleString()} subscribers
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <CreateSubscriberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lists={lists}
        defaultListId={selectedListId}
        onCreated={fetchData}
      />
    </div>
  );
}

interface CreateSubscriberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: EmailListDoc[];
  defaultListId?: string;
  onCreated: () => void;
}

function CreateSubscriberDialog({ open, onOpenChange, lists, defaultListId, onCreated }: CreateSubscriberDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [listId, setListId] = useState(defaultListId ?? '');
  const [tags, setTags] = useState('');
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!email.trim() || !listId) {
      toast({ title: 'Email and list are required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      const result = await actionCreateEmailSubscriber({
        email: email.trim(),
        listId,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        tags: tagArray.length ? tagArray : undefined,
      });
      if (!result.ok) {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Subscriber added' });
      setEmail(''); setFirstName(''); setLastName(''); setTags('');
      onCreated();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subscriber</DialogTitle>
          <DialogDescription>Add a single subscriber to one of your lists.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sub-email">Email</Label>
            <Input id="sub-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>List</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger><SelectValue placeholder="Pick a list" /></SelectTrigger>
              <SelectContent>
                {lists.map((l) => <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sub-first">First name</Label>
              <Input id="sub-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-last">Last name</Label>
              <Input id="sub-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-tags">Tags (comma-separated)</Label>
            <Input id="sub-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, customer" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Add subscriber'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
