'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, Search, Upload, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruToast,
} from '@/components/zoruui';
import {
  actionCreateEmailSubscriber,
  actionListEmailLists,
  actionListEmailSubscribers,
  type EmailListDoc,
  type EmailSubscriberDoc,
} from '@/app/actions/email/audience.actions';

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
      zoruToast({ title: 'Failed to load lists', description: listsResult.error, variant: 'destructive' });
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
      zoruToast({ title: 'Failed to load subscribers', description: subsResult.error, variant: 'destructive' });
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
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Users className="h-6 w-6" /> Subscribers
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>Manage every contact across your audience lists.</ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" disabled>
            <Upload className="h-4 w-4" /> Import CSV
          </ZoruButton>
          <ZoruButton onClick={() => setCreateOpen(true)} disabled={lists.length === 0}>
            <Plus className="h-4 w-4" /> Add subscriber
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <ZoruCard className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px] space-y-2">
          <ZoruLabel>Search</ZoruLabel>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
            <ZoruInput
              className="pl-8"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Email, first name, last name"
            />
          </div>
        </div>
        <div className="space-y-2 w-[200px]">
          <ZoruLabel>List</ZoruLabel>
          <ZoruSelect value={selectedListId || 'all'} onValueChange={(v) => { setSelectedListId(v === 'all' ? '' : v); setPage(1); }}>
            <ZoruSelectTrigger><ZoruSelectValue placeholder="All lists" /></ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All lists</ZoruSelectItem>
              {lists.map((l) => (
                <ZoruSelectItem key={l._id} value={l._id}>{l.name}</ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="space-y-2 w-[180px]">
          <ZoruLabel>Status</ZoruLabel>
          <ZoruSelect value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="subscribed">Subscribed</ZoruSelectItem>
              <ZoruSelectItem value="unsubscribed">Unsubscribed</ZoruSelectItem>
              <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
              <ZoruSelectItem value="bounced">Bounced</ZoruSelectItem>
              <ZoruSelectItem value="complained">Complained</ZoruSelectItem>
              <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </ZoruCard>

      {loading ? (
        <ZoruSkeleton className="h-96 w-full" />
      ) : subscribers.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No subscribers"
          description="Add subscribers manually, import a CSV, or embed a signup form."
        />
      ) : (
        <ZoruCard className="p-0 overflow-hidden">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Email</ZoruTableHead>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Tags</ZoruTableHead>
                <ZoruTableHead>Joined</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {subscribers.map((s) => (
                <ZoruTableRow key={s._id}>
                  <ZoruTableCell className="font-medium text-zoru-ink">{s.email}</ZoruTableCell>
                  <ZoruTableCell>
                    {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant="outline">{s.status}</ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(s.tags ?? []).slice(0, 3).map((t) => (
                        <ZoruBadge key={t} variant="outline" className="text-xs">{t}</ZoruBadge>
                      ))}
                      {(s.tags?.length ?? 0) > 3 ? (
                        <span className="text-xs text-zoru-ink-muted">+{(s.tags!.length - 3)}</span>
                      ) : null}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted text-sm">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zoru-ink-muted">
            Page {page} of {totalPages} · {total.toLocaleString()} subscribers
          </span>
          <div className="flex gap-2">
            <ZoruButton variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </ZoruButton>
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
      zoruToast({ title: 'Email and list are required', variant: 'destructive' });
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
        zoruToast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: 'Subscriber added' });
      setEmail(''); setFirstName(''); setLastName(''); setTags('');
      onCreated();
      onOpenChange(false);
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Add subscriber</ZoruDialogTitle>
          <ZoruDialogDescription>Add a single subscriber to one of your lists.</ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <ZoruLabel htmlFor="sub-email">Email</ZoruLabel>
            <ZoruInput id="sub-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <ZoruLabel>List</ZoruLabel>
            <ZoruSelect value={listId} onValueChange={setListId}>
              <ZoruSelectTrigger><ZoruSelectValue placeholder="Pick a list" /></ZoruSelectTrigger>
              <ZoruSelectContent>
                {lists.map((l) => <ZoruSelectItem key={l._id} value={l._id}>{l.name}</ZoruSelectItem>)}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <ZoruLabel htmlFor="sub-first">First name</ZoruLabel>
              <ZoruInput id="sub-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <ZoruLabel htmlFor="sub-last">Last name</ZoruLabel>
              <ZoruInput id="sub-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <ZoruLabel htmlFor="sub-tags">Tags (comma-separated)</ZoruLabel>
            <ZoruInput id="sub-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, customer" />
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</ZoruButton>
          <ZoruButton onClick={handleSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Add subscriber'}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
