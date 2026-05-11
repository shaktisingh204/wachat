'use client';

/**
 * Broadcast Cron — queue multiple broadcast configs across different
 * phone numbers, then fire them all at once with "Start Cron".
 *
 * Each queue entry uses a tags-based audience so no file upload is
 * needed per slot. Entries live in component state (ephemeral per
 * session). "Start Cron" fires all PENDING entries in parallel.
 *
 * Access is gated by the `wachat_broadcast_cron` permission module —
 * admins grant `create` to users who should be allowed to run cron
 * broadcasts via Admin → Users → Manage Permissions.
 */

import * as React from 'react';
import { useState, useTransition, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Loader2,
  Play,
  Tag as TagIcon,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import { getTemplates } from '@/app/actions/index.ts';
import { startCronBroadcast } from '@/app/actions/broadcast.actions';
import type { Template, Tag } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruEmptyState,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
} from '@/components/zoruui';

/* ── Types ─────────────────────────────────────────────────────────── */

type EntryStatus = 'pending' | 'starting' | 'started' | 'failed';

interface CronEntry {
  id: string;
  phoneNumberId: string;
  phoneLabel: string;
  templateId: string;
  templateName: string;
  tagIds: string[];
  tagNames: string[];
  status: EntryStatus;
  error?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function statusVariant(s: EntryStatus): 'secondary' | 'info' | 'success' | 'danger' {
  if (s === 'pending') return 'secondary';
  if (s === 'starting') return 'info';
  if (s === 'started') return 'success';
  return 'danger';
}

function statusLabel(s: EntryStatus) {
  if (s === 'pending') return 'Pending';
  if (s === 'starting') return 'Starting…';
  if (s === 'started') return 'Queued';
  return 'Failed';
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function BroadcastCronPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();

  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [isLoadingTemplates, startLoadTemplates] = useTransition();

  const [queue, setQueue] = useState<CronEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  // Add-form state
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [addError, setAddError] = useState('');

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  const fetchTemplates = useCallback(
    (pid: string) => {
      startLoadTemplates(async () => {
        const data = await getTemplates(pid);
        setTemplates(data || []);
      });
    },
    [],
  );

  useEffect(() => {
    if (activeProjectId) fetchTemplates(activeProjectId);
  }, [activeProjectId, fetchTemplates]);

  // Reset form when project changes
  useEffect(() => {
    setPhoneNumberId('');
    setTemplateId('');
    setSelectedTagIds([]);
    setAddError('');
  }, [activeProjectId]);

  /* Add an entry to the queue */
  const handleAdd = () => {
    setAddError('');
    if (!phoneNumberId) {
      setAddError('Choose a phone number.');
      return;
    }
    if (!templateId) {
      setAddError('Choose a template.');
      return;
    }
    if (selectedTagIds.length === 0) {
      setAddError('Select at least one audience tag.');
      return;
    }

    const phone = (activeProject?.phoneNumbers || []).find(
      (p) => p.id === phoneNumberId,
    );
    const tmpl = templates.find((t) => t._id.toString() === templateId);
    const tags = (activeProject?.tags || []) as Tag[];

    setQueue((prev) => [
      ...prev,
      {
        id: uid(),
        phoneNumberId,
        phoneLabel: phone
          ? `${phone.display_phone_number} · ${phone.verified_name}`
          : phoneNumberId,
        templateId,
        templateName: tmpl?.name ?? templateId,
        tagIds: selectedTagIds,
        tagNames: selectedTagIds.map(
          (id) => tags.find((t) => t._id === id)?.name ?? id,
        ),
        status: 'pending',
      },
    ]);

    setPhoneNumberId('');
    setTemplateId('');
    setSelectedTagIds([]);
  };

  /* Remove a single entry */
  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  };

  /* Fire all PENDING entries in parallel */
  const handleStartCron = async () => {
    const pending = queue.filter((e) => e.status === 'pending');
    if (pending.length === 0) {
      toast({ title: 'Nothing to start', description: 'Add at least one broadcast to the queue first.' });
      return;
    }
    if (!activeProjectId) return;

    setIsStarting(true);

    // Mark all pending as "starting"
    setQueue((prev) =>
      prev.map((e) =>
        e.status === 'pending' ? { ...e, status: 'starting' as EntryStatus } : e,
      ),
    );

    const results = await Promise.allSettled(
      pending.map((entry) =>
        startCronBroadcast({
          projectId: activeProjectId,
          phoneNumberId: entry.phoneNumberId,
          templateId: entry.templateId,
          tagIds: entry.tagIds,
        }).then((res) => ({ entryId: entry.id, res })),
      ),
    );

    let successCount = 0;
    let failCount = 0;

    setQueue((prev) => {
      const next = [...prev];
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { entryId, res } = result.value;
          const idx = next.findIndex((e) => e.id === entryId);
          if (idx !== -1) {
            if (res.error) {
              next[idx] = { ...next[idx], status: 'failed', error: res.error };
              failCount++;
            } else {
              next[idx] = { ...next[idx], status: 'started', error: undefined };
              successCount++;
            }
          }
        } else {
          failCount++;
        }
      });
      return next;
    });

    setIsStarting(false);

    if (successCount > 0 && failCount === 0) {
      toast({
        title: 'Cron started',
        description: `${successCount} broadcast${successCount === 1 ? '' : 's'} queued successfully.`,
      });
    } else if (successCount > 0) {
      toast({
        title: 'Partial success',
        description: `${successCount} queued, ${failCount} failed.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'All failed',
        description: 'None of the broadcasts could be queued. Check the errors below.',
        variant: 'destructive',
      });
    }
  };

  /* Clear completed/failed entries */
  const handleClearDone = () => {
    setQueue((prev) => prev.filter((e) => e.status === 'pending'));
  };

  const pendingCount = queue.filter((e) => e.status === 'pending').length;
  const tags = (activeProject?.tags || []) as Tag[];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Broadcast Cron</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Broadcast Cron
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Queue multiple broadcasts across different numbers, then fire them all at once.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queue.some((e) => e.status === 'started' || e.status === 'failed') && (
            <ZoruButton variant="outline" size="sm" onClick={handleClearDone}>
              Clear done
            </ZoruButton>
          )}
          <ZoruButton
            size="sm"
            onClick={handleStartCron}
            disabled={isStarting || pendingCount === 0}
          >
            {isStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isStarting
              ? 'Starting…'
              : `Start Cron${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </ZoruButton>
        </div>
      </div>

      {/* Queue */}
      <section>
        <h2 className="text-[18px] tracking-tight text-zoru-ink leading-none mb-4">
          Broadcast Queue
        </h2>
        {queue.length === 0 ? (
          <ZoruEmptyState
            icon={<Timer />}
            title="Queue is empty"
            description="Add broadcasts using the form below, then hit Start Cron to fire them all."
          />
        ) : (
          <ZoruCard className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <th className="px-5 py-3">Phone Number</th>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Audience Tags</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-zoru-line last:border-0"
                  >
                    <td className="px-5 py-3 text-[13px] text-zoru-ink">
                      {entry.phoneLabel}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-zoru-ink-muted">
                      {entry.templateName}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.tagNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[11px] text-zoru-ink"
                          >
                            <TagIcon className="h-2.5 w-2.5" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <ZoruBadge variant={statusVariant(entry.status)}>
                          {entry.status === 'starting' && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          )}
                          {statusLabel(entry.status)}
                        </ZoruBadge>
                        {entry.error && (
                          <span className="text-[10.5px] text-zoru-danger leading-tight max-w-[200px]">
                            {entry.error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {entry.status === 'pending' && (
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemove(entry.id)}
                          aria-label="Remove"
                          className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ZoruButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ZoruCard>
        )}
      </section>

      {/* Add Broadcast Form */}
      <section>
        <h2 className="text-[18px] tracking-tight text-zoru-ink leading-none mb-4">
          Add to Queue
        </h2>
        <ZoruCard className="p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Phone number */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Phone Number <span className="text-zoru-danger">*</span>
              </ZoruLabel>
              <ZoruSelect value={phoneNumberId} onValueChange={setPhoneNumberId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Choose a number…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {(activeProject?.phoneNumbers || []).length === 0 ? (
                    <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                      No phone numbers on this project.
                    </div>
                  ) : (
                    (activeProject?.phoneNumbers || []).map((phone) => (
                      <ZoruSelectItem key={phone.id} value={phone.id}>
                        {phone.display_phone_number} · {phone.verified_name}
                      </ZoruSelectItem>
                    ))
                  )}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Template */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Template <span className="text-zoru-danger">*</span>
              </ZoruLabel>
              <ZoruSelect
                value={templateId}
                onValueChange={setTemplateId}
                disabled={isLoadingTemplates}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue
                    placeholder={
                      isLoadingTemplates ? 'Loading…' : 'Choose a template…'
                    }
                  />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {approvedTemplates.length === 0 ? (
                    <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                      No approved templates.
                    </div>
                  ) : (
                    approvedTemplates.map((t) => (
                      <ZoruSelectItem key={t._id.toString()} value={t._id.toString()}>
                        {t.name}
                      </ZoruSelectItem>
                    ))
                  )}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Audience Tags <span className="text-zoru-danger">*</span>
              </ZoruLabel>
              <ZoruPopover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <ZoruPopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={tagPopoverOpen}
                    className={cn(
                      'inline-flex h-10 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-[13px] transition-colors hover:bg-zoru-surface',
                      selectedTagIds.length === 0 && 'text-zoru-ink-muted',
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <TagIcon className="h-3.5 w-3.5" />
                      {selectedTagIds.length > 0
                        ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'} selected`
                        : 'Select tags…'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <ZoruCommand>
                    <ZoruCommandInput placeholder="Search tags…" />
                    <ZoruCommandList>
                      <ZoruCommandEmpty>No tags found.</ZoruCommandEmpty>
                      <ZoruCommandGroup>
                        {tags.map((tag) => {
                          const isSelected = selectedTagIds.includes(tag._id);
                          return (
                            <ZoruCommandItem
                              key={tag._id}
                              value={tag.name}
                              onSelect={() => {
                                const next = isSelected
                                  ? selectedTagIds.filter((id) => id !== tag._id)
                                  : [...selectedTagIds, tag._id];
                                setSelectedTagIds(next);
                              }}
                            >
                              <span
                                className={cn(
                                  'mr-2 flex h-4 w-4 items-center justify-center rounded-[3px] border',
                                  isSelected
                                    ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                                    : 'border-zoru-line',
                                )}
                              >
                                {isSelected ? <Check className="h-3 w-3" /> : null}
                              </span>
                              <span
                                className="mr-2 h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span>{tag.name}</span>
                            </ZoruCommandItem>
                          );
                        })}
                      </ZoruCommandGroup>
                    </ZoruCommandList>
                  </ZoruCommand>
                </ZoruPopoverContent>
              </ZoruPopover>
            </div>
          </div>

          {/* Selected tag pills */}
          {selectedTagIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedTagIds.map((id) => {
                const tag = tags.find((t) => t._id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface px-2.5 py-0.5 text-[12px] text-zoru-ink"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag?.color }}
                    />
                    {tag?.name ?? id}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) => prev.filter((x) => x !== id))
                      }
                      className="ml-0.5 text-zoru-ink-muted hover:text-zoru-danger"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Validation error */}
          {addError && (
            <div className="mt-3 flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-danger/40 bg-zoru-danger/5 px-3 py-2 text-[12px] text-zoru-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {addError}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-zoru-line pt-4">
            <p className="text-[12px] text-zoru-ink-muted">
              Each entry uses the selected number and fires against all contacts matching the
              chosen tags.
            </p>
            <ZoruButton onClick={handleAdd} disabled={!activeProjectId}>
              Add to Queue
            </ZoruButton>
          </div>
        </ZoruCard>
      </section>

      <div className="h-6" />
    </div>
  );
}
