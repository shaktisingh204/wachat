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
  EmptyState,
  Input,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  Search,
  GitMerge,
  Check,
  Users,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getContactsPageData, updateContactTags } from '@/app/actions/contact.actions';

/**
 * Wachat Contact Merge — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
    if (!contactA || !contactB) return;
    setMerging(true);
    const combinedTags = [
      ...new Set([...(contactA.tagIds || []), ...(contactB.tagIds || [])]),
    ];
    const res = await updateContactTags(contactA._id, combinedTags);
    if (res.success) {
      toast({
        title: 'Merged',
        description: `Tags from "${contactB.name || contactB.waId}" merged into "${contactA.name || contactA.waId}".`,
        tone: 'success',
      });
      setSelected([null, null]);
      load(query);
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Merge failed.',
        tone: 'danger',
      });
    }
    setMerging(false);
  };

  const renderContact = (c: any, label: string) => (
    <div className="min-w-[200px] flex-1">
      <p
        className="mb-2 text-[11px] uppercase tracking-wide"
        style={{ color: 'var(--st-text-tertiary)' }}
      >
        {label}
      </p>
      <div className="space-y-2 text-[13px]">
        <p>
          <span style={{ color: 'var(--st-text-secondary)' }}>Name: </span>
          <span style={{ color: 'var(--st-text)' }}>{c.name || 'Unknown'}</span>
        </p>
        <p>
          <span style={{ color: 'var(--st-text-secondary)' }}>Phone: </span>
          <span className="font-mono" style={{ color: 'var(--st-text)' }}>
            {c.waId || '—'}
          </span>
        </p>
        <p>
          <span style={{ color: 'var(--st-text-secondary)' }}>Tags: </span>
          <span style={{ color: 'var(--st-text)' }}>{c.tagIds?.length || 0}</span>
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wide"
                  style={{
                    borderBottom: '1px solid var(--st-border)',
                    color: 'var(--st-text-tertiary)',
                  }}
                >
                  <th className="w-8 px-5 py-3" />
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Tags</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => {
                  const isSelected = selected.includes(c._id);
                  return (
                    <tr
                      key={c._id}
                      onClick={() => selectContact(c._id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderTop: '1px solid var(--st-border)',
                        background: isSelected
                          ? 'var(--st-bg-secondary)'
                          : 'transparent',
                      }}
                    >
                      <td className="px-5 py-3">
                        <div
                          className="flex h-5 w-5 items-center justify-center transition-colors"
                          style={{
                            borderRadius: '4px',
                            border: isSelected
                              ? '2px solid var(--st-accent)'
                              : '2px solid var(--st-border)',
                            background: isSelected
                              ? 'var(--st-accent)'
                              : 'transparent',
                            color: isSelected ? '#fff' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          )}
                        </div>
                      </td>
                      <td
                        className="px-5 py-3 text-[13px]"
                        style={{ color: 'var(--st-text)' }}
                      >
                        {c.name || 'Unknown'}
                      </td>
                      <td
                        className="px-5 py-3 font-mono text-[13px]"
                        style={{ color: 'var(--st-text-secondary)' }}
                      >
                        {c.waId || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone="neutral">{c.tagIds?.length || 0} tags</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {contactA && contactB && (
          <Card padding="md">
            <h2
              className="mb-4 text-[15px] font-medium"
              style={{ color: 'var(--st-text)' }}
            >
              Compare &amp; merge
            </h2>
            <div className="flex flex-wrap gap-6">
              {renderContact(contactA, 'Primary (keep)')}
              <div className="hidden items-center sm:flex">
                <GitMerge
                  className="h-6 w-6"
                  style={{ color: 'var(--st-text-tertiary)' }}
                  aria-hidden="true"
                />
              </div>
              {renderContact(
                contactB,
                'Secondary (merge tags into primary)',
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
                      Tags from "{contactB.name || contactB.waId}" will be
                      combined into "{contactA.name || contactA.waId}". This
                      cannot be undone.
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
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
