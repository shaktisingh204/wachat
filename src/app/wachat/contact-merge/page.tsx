'use client';

import {
  useToast,
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
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Input,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  Search,
  GitMerge,
  Users,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';
import { AiDuplicateFinder } from '@/components/wachat/contacts/ai-duplicate-finder';
import {
  mergeContacts,
  type MergeContactsResult,
} from '@/app/actions/wachat-contact-merge.actions';

/**
 * Wachat Contact Merge -- rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeContactsResult | null>(
    null,
  );

  const load = useCallback(
    (search = '') => {
      if (!activeProject?._id) return;
      startTransition(async () => {
        const res = await getContactsPageData(
          String(activeProject._id),
          undefined,
          1,
          search,
        );
        setContacts(res.contacts ?? []);
      });
    },
    [activeProject?._id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => load(query);

  const selectContact = (id: string) => {
    if (selected[0] === id) {
      setSelected([null, selected[1]]);
      return;
    }
    if (selected[1] === id) {
      setSelected([selected[0], null]);
      return;
    }
    if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([id, null]);
  };

  const contactA = contacts.find((c) => c._id === selected[0]);
  const contactB = contacts.find((c) => c._id === selected[1]);

  const handleMerge = async () => {
    if (!activeProject?._id || !contactA || !contactB) return;
    setMerging(true);
    setMergeResult(null);
    const res = await mergeContacts(
      String(activeProject._id),
      contactA._id,
      contactB._id,
    );
    if (res.success) {
      const merged = res.contact;
      const repointed =
        (res.incomingRepointed ?? 0) + (res.outgoingRepointed ?? 0);
      toast({
        title: 'Contacts merged',
        description: `"${contactB.name || contactB.waId}" was folded into "${merged?.name || merged?.waId || contactA.name || contactA.waId}". ${repointed} message${repointed === 1 ? '' : 's'} re-pointed.`,
        tone: 'success',
      });
      setMergeResult(res);
      setSelected([null, null]);
      load(query);
    } else {
      toast({
        title: 'Merge failed',
        description: res.error || 'Merge failed.',
        tone: 'danger',
      });
    }
    setMerging(false);
  };

  const renderContact = (c: any, label: string) => (
    <div className="min-w-[200px] flex-1">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </p>
      <div className="space-y-2 text-[13px]">
        <p>
          <span className="text-[var(--st-text-secondary)]">Name: </span>
          <span className="text-[var(--st-text)]">{c.name || 'Unknown'}</span>
        </p>
        <p>
          <span className="text-[var(--st-text-secondary)]">Phone: </span>
          <span className="font-mono text-[var(--st-text)]">
            {c.waId || '—'}
          </span>
        </p>
        <p>
          <span className="text-[var(--st-text-secondary)]">Tags: </span>
          <span className="text-[var(--st-text)]">{c.tagIds?.length || 0}</span>
        </p>
      </div>
    </div>
  );

  const isLoadingInitial = isPending && contacts.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Merge' },
      ]}
      title="Contact Merge"
      description="Find and merge duplicate contacts to keep your list clean."
      width="wide"
    >
      <div className="flex flex-col gap-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search contacts by name or phone…"
                aria-label="Search contacts by name or phone"
                iconLeft={Search}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSearch}
              loading={isPending}
              disabled={isPending}
            >
              Search
            </Button>
          </div>
        </Card>

        {contacts.length > 1 ? (
          <AiDuplicateFinder
            contacts={contacts.map((c: any) => ({
              id: c._id?.toString?.() ?? String(c._id),
              name: c.name,
              phone: c.waId,
            }))}
            onSelectPair={(aId, bId) => setSelected([aId, bId])}
          />
        ) : null}

        {isLoadingInitial ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="3rem" width="100%" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description={
              isPending
                ? 'Loading…'
                : 'Try a different search to surface duplicates.'
            }
          />
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th className="w-8 px-5 py-3" />
                  <Th className="px-5 py-3">Name</Th>
                  <Th className="px-5 py-3">Phone</Th>
                  <Th className="px-5 py-3">Tags</Th>
                </Tr>
              </THead>
              <TBody>
                {contacts.map((c: any) => {
                  const isSelected = selected.includes(c._id);
                  return (
                    <Tr
                      key={c._id}
                      onClick={() => selectContact(c._id)}
                      className={[
                        'cursor-pointer transition-colors',
                        isSelected ? 'bg-[var(--st-bg-secondary)]' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <Td className="px-5 py-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => selectContact(c._id)}
                          aria-label={`Select ${c.name || c.waId}`}
                        />
                      </Td>
                      <Td className="px-5 py-3 text-[13px] text-[var(--st-text)]">
                        {c.name || 'Unknown'}
                      </Td>
                      <Td className="px-5 py-3 font-mono text-[13px] text-[var(--st-text-secondary)]">
                        {c.waId || '—'}
                      </Td>
                      <Td className="px-5 py-3">
                        <Badge tone="neutral">{c.tagIds?.length || 0} tags</Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}

        {contactA && contactB && (
          <Card padding="md">
            <CardHeader>
              <CardTitle>Compare &amp; merge</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-6">
                {renderContact(contactA, 'Primary (keep)')}
                <div className="hidden items-center sm:flex">
                  <GitMerge
                    className="h-6 w-6 text-[var(--st-text-tertiary)]"
                    aria-hidden="true"
                  />
                </div>
                {renderContact(
                  contactB,
                  'Secondary (folded into primary, then deleted)',
                )}
              </div>
              <div className="mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="primary"
                      iconLeft={GitMerge}
                      loading={merging}
                      disabled={merging}
                    >
                      {merging ? 'Merging…' : 'Merge contacts'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Merge contacts?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{contactB.name || contactB.waId}" will be folded into "
                        {contactA.name || contactA.waId}" — non-empty fields,
                        tags and variables are unioned (primary wins), all of
                        its messages are re-pointed to the primary, and the
                        secondary contact is permanently deleted. This cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction intent="primary" onClick={handleMerge}>
                        Merge
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardBody>
          </Card>
        )}

        {mergeResult?.success && mergeResult.contact && (
          <Card padding="md">
            <CardHeader>
              <CardTitle>Merge complete</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-4">
                <div className="space-y-2 text-[13px]">
                  <p>
                    <span className="text-[var(--st-text-secondary)]">
                      Surviving contact:{' '}
                    </span>
                    <span className="text-[var(--st-text)]">
                      {mergeResult.contact.name || 'Unknown'}
                    </span>
                  </p>
                  <p>
                    <span className="text-[var(--st-text-secondary)]">
                      Phone:{' '}
                    </span>
                    <span className="font-mono text-[var(--st-text)]">
                      {mergeResult.contact.waId || '—'}
                    </span>
                  </p>
                  <p>
                    <span className="text-[var(--st-text-secondary)]">
                      Tags:{' '}
                    </span>
                    <span className="text-[var(--st-text)]">
                      {mergeResult.contact.tagIds?.length || 0}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">
                    {mergeResult.incomingRepointed ?? 0} incoming re-pointed
                  </Badge>
                  <Badge tone="success">
                    {mergeResult.outgoingRepointed ?? 0} outgoing re-pointed
                  </Badge>
                  <Badge tone="neutral">
                    {mergeResult.conversationsRemoved ?? 0} stale conversation
                    {(mergeResult.conversationsRemoved ?? 0) === 1
                      ? ''
                      : 's'}{' '}
                    removed
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
