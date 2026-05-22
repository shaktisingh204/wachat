'use client';

import {
  useZoruToast,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  EmptyState,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Play,
  Tag as TagIcon,
  Timer,
  Trash2,
  Upload,
  X,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates } from '@/app/actions/template.actions';
import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import type { Template,
  Tag } from '@/lib/definitions';
import type { WithId } from 'mongodb';

/**
 * Broadcast Cron — same composer as the regular Broadcast page (one
 * template + variables + media inputs at the top), then a queue of
 * phone+audience rows. "Start Cron" fires the same configured broadcast
 * once per queued row (different phone number / different audience).
 *
 * Each row calls `handleStartBroadcast` with FormData cloned from the
 * top-level composer form, overriding `phoneNumberId`, `audienceType`,
 * `tagIds` / `csvFile` per row. That way template-variable + header-media
 * parsing on the server is identical to the regular broadcast path —
 * no duplicate component-builder logic on the client.
 */

import * as React from 'react';

import { SabFileToFileButton } from '@/components/sabfiles';

import { TemplateInputRenderer } from '../_components/template-input-renderer';

/* ── Types ─────────────────────────────────────────────────────────── */

type EntryStatus = 'pending' | 'starting' | 'started' | 'failed';
type AudienceKind = 'file' | 'tags';

interface CronEntry {
  id: string;
  phoneNumberId: string;
  phoneLabel: string;
  audienceType: AudienceKind;
  tagIds: string[];
  tagNames: string[];
  csvFile: File | null;
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

// Generic variable hints used when the audience is tags (no CSV headers
// to derive from). Mirrors what the regular broadcast form shows.
const TAG_VARIABLE_HINTS = [
  'name',
  'phone',
  'email',
  'custom_field_1',
  'custom_field_2',
  'custom_field_3',
];

/* ── Page ───────────────────────────────────────────────────────────── */

export default function BroadcastCronPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const composerRef = useRef<HTMLFormElement>(null);

  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [isLoadingTemplates, startLoadTemplates] = useTransition();

  const [selectedTemplate, setSelectedTemplate] =
    useState<WithId<Template> | null>(null);
  const [createContacts, setCreateContacts] = useState(false);

  const [queue, setQueue] = useState<CronEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  // Add-form state
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceKind>('tags');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [addError, setAddError] = useState('');

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  const fetchTemplates = useCallback((pid: string) => {
    startLoadTemplates(async () => {
      const data = await getTemplates(pid);
      setTemplates(data || []);
    });
  }, []);

  useEffect(() => {
    if (activeProjectId) fetchTemplates(activeProjectId);
  }, [activeProjectId, fetchTemplates]);

  // Reset everything when the project changes.
  useEffect(() => {
    setSelectedTemplate(null);
    setQueue([]);
    setPhoneNumberId('');
    setAudienceType('tags');
    setSelectedTagIds([]);
    setCsvFile(null);
    setCreateContacts(false);
    setAddError('');
  }, [activeProjectId]);

  /* Add an entry to the queue */
  const handleAdd = () => {
    setAddError('');
    if (!phoneNumberId) {
      setAddError('Choose a phone number.');
      return;
    }
    if (!selectedTemplate) {
      setAddError('Pick a template.');
      return;
    }
    if (audienceType === 'tags' && selectedTagIds.length === 0) {
      setAddError('Select at least one audience tag.');
      return;
    }
    if (audienceType === 'file' && !csvFile) {
      setAddError('Pick a contact file (CSV or XLSX).');
      return;
    }

    const phone = (activeProject?.phoneNumbers || []).find(
      (p) => p.id === phoneNumberId,
    );
    const tags = (activeProject?.tags || []) as Tag[];

    setQueue((prev) => [
      ...prev,
      {
        id: uid(),
        phoneNumberId,
        phoneLabel: phone
          ? `${phone.display_phone_number} · ${phone.verified_name}`
          : phoneNumberId,
        audienceType,
        tagIds: audienceType === 'tags' ? selectedTagIds : [],
        tagNames:
          audienceType === 'tags'
            ? selectedTagIds.map(
                (id) => tags.find((t) => t._id === id)?.name ?? id,
              )
            : [],
        csvFile: audienceType === 'file' ? csvFile : null,
        status: 'pending',
      },
    ]);

    setPhoneNumberId('');
    setSelectedTagIds([]);
    setCsvFile(null);
  };

  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  };

  /* Fire every PENDING entry in parallel via handleStartBroadcast. */
  const handleStartCron = async () => {
    if (!selectedTemplate) {
      toast({
        title: 'Pick a template first',
        description: 'Choose the template to send before starting the cron.',
      });
      return;
    }
    const pending = queue.filter((e) => e.status === 'pending');
    if (pending.length === 0) {
      toast({
        title: 'Nothing to start',
        description: 'Add at least one entry to the queue first.',
      });
      return;
    }
    if (!activeProjectId || !composerRef.current) return;

    setIsStarting(true);
    setQueue((prev) =>
      prev.map((e) =>
        e.status === 'pending' ? { ...e, status: 'starting' as EntryStatus } : e,
      ),
    );

    const baseFormEl = composerRef.current;
    const results = await Promise.allSettled(
      pending.map(async (entry) => {
        // Clone the composer FormData so per-row overrides don't leak.
        const formData = new FormData(baseFormEl);
        formData.set('phoneNumberId', entry.phoneNumberId);
        formData.set('audienceType', entry.audienceType);
        formData.delete('tagIds');
        if (entry.audienceType === 'tags') {
          entry.tagIds.forEach((t) => formData.append('tagIds', t));
          formData.delete('csvFile');
        } else if (entry.csvFile) {
          formData.set('csvFile', entry.csvFile, entry.csvFile.name);
        }
        const res = await handleStartBroadcast(
          { message: undefined, error: undefined },
          formData,
        );
        return { entryId: entry.id, res };
      }),
    );

    let successCount = 0;
    let failCount = 0;

    setQueue((prev) => {
      const next = [...prev];
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          const { entryId, res } = r.value;
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
        description:
          'None of the broadcasts could be queued. Check the errors below.',
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

  const templateLocked = queue.length > 0;

  const handleTemplateChange = (templateId: string) => {
    if (templateLocked) return;
    const t = templates.find((tt) => tt._id.toString() === templateId);
    setSelectedTemplate(t || null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
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
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Broadcast Cron
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Pick one template, fill its variables once, then queue any number of
            phone + audience pairs and fire them all together.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queue.some((e) => e.status === 'started' || e.status === 'failed') && (
            <Button variant="outline" size="sm" onClick={handleClearDone}>
              Clear done
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleStartCron}
            disabled={isStarting || pendingCount === 0 || !selectedTemplate}
          >
            {isStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isStarting
              ? 'Starting…'
              : `Start Cron${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </Button>
        </div>
      </div>

      {/* ── Add Entry ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[16px] font-medium text-zoru-ink leading-none">
            1 · Add entry
          </h2>
          <p className="mt-1.5 text-[12px] text-zoru-ink-muted">
            Pick a phone number, then the template, then this entry's audience.
          </p>
        </div>
        <Card className="p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Phone number */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Phone Number <span className="text-zoru-danger">*</span>
              </Label>
              <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
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
              </Select>
            </div>

            {/* Template — global; locks once any row is queued. */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                  Template <span className="text-zoru-danger">*</span>
                </Label>
                {templateLocked && (
                  <span className="text-[10px] text-zoru-ink-muted">
                    Locked · clear queue to switch
                  </span>
                )}
              </div>
              <Select
                value={selectedTemplate?._id.toString()}
                onValueChange={handleTemplateChange}
                disabled={isLoadingTemplates || templateLocked}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue
                    placeholder={
                      isLoadingTemplates
                        ? 'Loading templates…'
                        : 'Choose an approved template…'
                    }
                  />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {approvedTemplates.length === 0 ? (
                    <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                      No approved templates. Sync with Meta or create one.
                    </div>
                  ) : (
                    approvedTemplates.map((t) => (
                      <ZoruSelectItem
                        key={t._id.toString()}
                        value={t._id.toString()}
                      >
                        {t.name}
                      </ZoruSelectItem>
                    ))
                  )}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          {/* Audience type */}
          <div className="mt-5 flex flex-col gap-1.5">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
              Audience <span className="text-zoru-danger">*</span>
            </Label>
            <RadioGroup
              value={audienceType}
              onValueChange={(v) => setAudienceType(v as AudienceKind)}
              className="flex gap-2"
            >
              <AudienceOption
                value="tags"
                id="cron-aud-tags"
                label="From tags"
                description="Existing segments"
                active={audienceType === 'tags'}
              />
              <AudienceOption
                value="file"
                id="cron-aud-file"
                label="Upload file"
                description="CSV or XLSX"
                active={audienceType === 'file'}
              />
            </RadioGroup>
          </div>

          {/* Audience inputs */}
          <div className="mt-5">
            {audienceType === 'tags' ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                  Audience Tags <span className="text-zoru-danger">*</span>
                </Label>
                <Popover
                  open={tagPopoverOpen}
                  onOpenChange={setTagPopoverOpen}
                >
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
                                    ? selectedTagIds.filter(
                                        (id) => id !== tag._id,
                                      )
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
                                  {isSelected ? (
                                    <Check className="h-3 w-3" />
                                  ) : null}
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
                </Popover>
                {selectedTagIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
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
                              setSelectedTagIds((prev) =>
                                prev.filter((x) => x !== id),
                              )
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
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                  Contact file <span className="text-zoru-danger">*</span>
                </Label>
                <div
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-[var(--zoru-radius)] border border-dashed px-4 py-3',
                    csvFile
                      ? 'border-zoru-accent bg-zoru-surface'
                      : 'border-zoru-line bg-zoru-bg',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {csvFile ? (
                      <FileText className="h-4 w-4 text-zoru-accent" />
                    ) : (
                      <Upload className="h-4 w-4 text-zoru-ink-muted" />
                    )}
                    <span className="truncate text-[13px] text-zoru-ink">
                      {csvFile?.name ?? 'Pick a CSV or XLSX file from SabFiles'}
                    </span>
                  </div>
                  <SabFileToFileButton
                    accept="document"
                    onPickFile={(file) => setCsvFile(file)}
                    onError={(err) =>
                      toast({
                        title: 'Pick failed',
                        description: err.message,
                        variant: 'destructive',
                      })
                    }
                  >
                    {csvFile ? 'Replace' : 'Pick from SabFiles'}
                  </SabFileToFileButton>
                </div>
                <p className="text-[11px] text-zoru-ink-muted">
                  Required columns: <code>phone</code>, plus a column per
                  template variable (e.g. <code>variable1</code>).
                </p>
              </div>
            )}
          </div>

          {/* Validation error */}
          {addError && (
            <div className="mt-3 flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-danger/40 bg-zoru-danger/5 px-3 py-2 text-[12px] text-zoru-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {addError}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-zoru-line pt-4">
            <p className="text-[12px] text-zoru-ink-muted">
              Each entry sends the chosen template (with variables and media
              set in the cards below) from this number to the chosen audience.
            </p>
            <Button onClick={handleAdd} disabled={!activeProjectId}>
              Add to Queue
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Queue ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-medium text-zoru-ink leading-none">
              2 · Broadcast queue
            </h2>
            <p className="mt-1.5 text-[12px] text-zoru-ink-muted">
              Each entry fires the chosen template from its phone number to its
              own audience.
            </p>
          </div>
          {queue.length > 0 && (
            <span className="text-[11.5px] text-zoru-ink-muted">
              {pendingCount} pending · {queue.length} total
            </span>
          )}
        </div>
        {queue.length === 0 ? (
          <EmptyState
            icon={<Timer />}
            title="Queue is empty"
            description="Use the form above to add phone + audience pairs, then hit Start Cron."
          />
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <th className="px-5 py-3">Phone Number</th>
                  <th className="px-5 py-3">Audience</th>
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
                    <td className="px-5 py-3">
                      {entry.audienceType === 'tags' ? (
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
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-zoru-ink-muted">
                          <FileText className="h-3 w-3" />
                          {entry.csvFile?.name ?? 'file'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={statusVariant(entry.status)}>
                          {entry.status === 'starting' && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          )}
                          {statusLabel(entry.status)}
                        </Badge>
                        {entry.error && (
                          <span className="text-[10.5px] text-zoru-danger leading-tight max-w-[260px]">
                            {entry.error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {entry.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemove(entry.id)}
                          aria-label="Remove"
                          className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* ── Composer form: hidden plumbing + template variables + options ── */}
      <form ref={composerRef} className="flex flex-col gap-5">
        <input
          type="hidden"
          name="projectId"
          value={activeProjectId ?? ''}
        />
        <input type="hidden" name="broadcastType" value="template" />
        <input
          type="hidden"
          name="createContacts"
          value={createContacts ? 'true' : 'false'}
        />
        <input
          type="hidden"
          name="templateId"
          value={selectedTemplate?._id.toString() ?? ''}
        />

        {/* Template variables — visible once a template is picked above. */}
        {selectedTemplate && (
          <Card className="p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-[16px] font-medium text-zoru-ink leading-none">
                  Template variables
                </h2>
                <p className="mt-1.5 text-[12px] text-zoru-ink-muted">
                  These values apply to every entry queued above.
                </p>
              </div>
              <TemplateInputRenderer
                template={selectedTemplate}
                variableOptions={TAG_VARIABLE_HINTS}
              />
            </div>
          </Card>
        )}

        {/* Options */}
        <Card className="p-5">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createContacts}
              onChange={(e) => setCreateContacts(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zoru-line text-zoru-accent focus:ring-zoru-accent"
            />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-zoru-ink">
                Create contacts in CRM
              </span>
              <span className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                {createContacts
                  ? 'New recipients will be added to your CRM as they receive this broadcast.'
                  : 'Off — only existing contacts will be updated.'}
              </span>
            </div>
          </label>
        </Card>
      </form>

      <div className="h-6" />
    </div>
  );
}

/* ── Local UI helpers ──────────────────────────────────────────────── */

function AudienceOption({
  value,
  id,
  label,
  description,
  active,
}: {
  value: string;
  id: string;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-[var(--zoru-radius)] border px-3 py-2.5 transition-colors',
        active
          ? 'border-zoru-accent bg-zoru-surface'
          : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium leading-tight text-zoru-ink">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-tight text-zoru-ink-muted">
          {description}
        </span>
      </div>
    </label>
  );
}
