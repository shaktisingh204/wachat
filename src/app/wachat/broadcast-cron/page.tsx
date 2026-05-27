'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { m, useReducedMotion } from 'motion/react';
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
import type { Template, Tag } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
  useZoruToast,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
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

import { SabFileToFileButton } from '@/components/sabfiles';

import { TemplateInputRenderer } from '../_components/template-input-renderer';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat broadcast cron - pick one template once, queue many phone+audience
 * pairs, fire them all together via handleStartBroadcast.
 * Same logic; wachat-ui chrome.
 */

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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function statusTone(s: EntryStatus): StatusTone {
  if (s === 'pending') return 'draft';
  if (s === 'starting') return 'sending';
  if (s === 'started') return 'queued';
  return 'failed';
}

function statusLabel(s: EntryStatus) {
  if (s === 'pending') return 'Pending';
  if (s === 'starting') return 'Starting';
  if (s === 'started') return 'Queued';
  return 'Failed';
}

const TAG_VARIABLE_HINTS = ['name', 'phone', 'email', 'custom_field_1', 'custom_field_2', 'custom_field_3'];

export default function BroadcastCronPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const reduce = useReducedMotion();
  const composerRef = useRef<HTMLFormElement>(null);

  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [isLoadingTemplates, startLoadTemplates] = useTransition();

  const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);
  const [createContacts, setCreateContacts] = useState(false);

  const [queue, setQueue] = useState<CronEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceKind>('tags');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [addError, setAddError] = useState('');

  const approvedTemplates = templates.filter((t) => t.status?.toUpperCase() === 'APPROVED');

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

    const phone = (activeProject?.phoneNumbers || []).find((p) => p.id === phoneNumberId);
    const tags = (activeProject?.tags || []) as Tag[];

    setQueue((prev) => [
      ...prev,
      {
        id: uid(),
        phoneNumberId,
        phoneLabel: phone ? `${phone.display_phone_number} / ${phone.verified_name}` : phoneNumberId,
        audienceType,
        tagIds: audienceType === 'tags' ? selectedTagIds : [],
        tagNames:
          audienceType === 'tags'
            ? selectedTagIds.map((id) => tags.find((t) => t._id === id)?.name ?? id)
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

  const handleStartCron = async () => {
    if (!selectedTemplate) {
      toast({ title: 'Pick a template first', description: 'Choose the template to send before starting the cron.' });
      return;
    }
    const pending = queue.filter((e) => e.status === 'pending');
    if (pending.length === 0) {
      toast({ title: 'Nothing to start', description: 'Add at least one entry to the queue first.' });
      return;
    }
    if (!activeProjectId || !composerRef.current) return;

    setIsStarting(true);
    setQueue((prev) =>
      prev.map((e) => (e.status === 'pending' ? { ...e, status: 'starting' as EntryStatus } : e)),
    );

    const baseFormEl = composerRef.current;
    const results = await Promise.allSettled(
      pending.map(async (entry) => {
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
        const res = await handleStartBroadcast({ message: undefined, error: undefined }, formData);
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
        description: 'None of the broadcasts could be queued. Check the errors below.',
        variant: 'destructive',
      });
    }
  };

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
    <WaPage>
      <PageHeader
        title="Broadcast cron"
        description="Pick one template, fill its variables once, then queue any number of phone + audience pairs and fire them all together."
        kicker="Wachat / cron"
        eyebrowIcon={Timer}
        backHref="/wachat"
        actions={
          <>
            {queue.some((e) => e.status === 'started' || e.status === 'failed') && (
              <WaButton variant="outline" size="sm" onClick={handleClearDone}>
                Clear done
              </WaButton>
            )}
            <WaButton
              size="sm"
              onClick={handleStartCron}
              disabled={isStarting || pendingCount === 0 || !selectedTemplate}
              leftIcon={isStarting ? Loader2 : Play}
            >
              {isStarting ? 'Starting' : `Start cron${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </WaButton>
          </>
        }
      />

      {/* ── Add Entry ─────────────────────────────────────────────── */}
      <Section title="1 / Add entry" description="Pick a phone number, then the template, then this entry's audience.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">
              Phone number <span className="text-rose-600">*</span>
            </Label>
            <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Choose a number" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {(activeProject?.phoneNumbers || []).length === 0 ? (
                  <div className="px-2 py-4 text-center text-[12px] text-zinc-500">
                    No phone numbers on this project.
                  </div>
                ) : (
                  (activeProject?.phoneNumbers || []).map((phone) => (
                    <ZoruSelectItem key={phone.id} value={phone.id}>
                      {phone.display_phone_number} / {phone.verified_name}
                    </ZoruSelectItem>
                  ))
                )}
              </ZoruSelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">
                Template <span className="text-rose-600">*</span>
              </Label>
              {templateLocked && (
                <span className="text-[10px] text-zinc-500">Locked / clear queue to switch</span>
              )}
            </div>
            <Select
              value={selectedTemplate?._id.toString()}
              onValueChange={handleTemplateChange}
              disabled={isLoadingTemplates || templateLocked}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue
                  placeholder={isLoadingTemplates ? 'Loading templates' : 'Choose an approved template'}
                />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {approvedTemplates.length === 0 ? (
                  <div className="px-2 py-4 text-center text-[12px] text-zinc-500">
                    No approved templates. Sync with Meta or create one.
                  </div>
                ) : (
                  approvedTemplates.map((t) => (
                    <ZoruSelectItem key={t._id.toString()} value={t._id.toString()}>
                      {t.name}
                    </ZoruSelectItem>
                  ))
                )}
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <Label className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">
            Audience <span className="text-rose-600">*</span>
          </Label>
          <RadioGroup
            value={audienceType}
            onValueChange={(v) => setAudienceType(v as AudienceKind)}
            className="flex gap-2"
          >
            <AudienceOption value="tags" id="cron-aud-tags" label="From tags" description="Existing segments" active={audienceType === 'tags'} />
            <AudienceOption value="file" id="cron-aud-file" label="Upload file" description="CSV or XLSX" active={audienceType === 'file'} />
          </RadioGroup>
        </div>

        <div className="mt-5">
          {audienceType === 'tags' ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">
                Audience tags <span className="text-rose-600">*</span>
              </Label>
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <ZoruPopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={tagPopoverOpen}
                    className={cn(
                      'inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] transition-colors hover:border-zinc-900',
                      selectedTagIds.length === 0 && 'text-zinc-500',
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <TagIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {selectedTagIds.length > 0
                        ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'} selected`
                        : 'Select tags'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <ZoruCommand>
                    <ZoruCommandInput placeholder="Search tags" />
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
                                  isSelected ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300',
                                )}
                              >
                                {isSelected ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                              </span>
                              <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
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
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[12px] text-zinc-700"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag?.color }} />
                        {tag?.name ?? id}
                        <button
                          type="button"
                          onClick={() => setSelectedTagIds((prev) => prev.filter((x) => x !== id))}
                          className="ml-0.5 text-zinc-400 transition-colors hover:text-rose-600"
                        >
                          <X className="h-3 w-3" strokeWidth={2.25} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">
                Contact file <span className="text-rose-600">*</span>
              </Label>
              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3',
                  csvFile ? 'border-emerald-300 bg-emerald-50/60' : 'border-zinc-300 bg-white',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {csvFile ? (
                    <FileText className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
                  ) : (
                    <Upload className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
                  )}
                  <span className="truncate text-[13px] text-zinc-900">
                    {csvFile?.name ?? 'Pick a CSV or XLSX file from SabFiles'}
                  </span>
                </div>
                <SabFileToFileButton
                  accept="document"
                  onPickFile={(file) => setCsvFile(file)}
                  onError={(err) => toast({ title: 'Pick failed', description: err.message, variant: 'destructive' })}
                >
                  {csvFile ? 'Replace' : 'Pick from SabFiles'}
                </SabFileToFileButton>
              </div>
              <p className="text-[11px] text-zinc-500">
                Required columns: <code className="font-mono">phone</code>, plus a column per template variable (e.g.{' '}
                <code className="font-mono">variable1</code>).
              </p>
            </div>
          )}
        </div>

        {addError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            {addError}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
          <p className="text-[12px] text-zinc-500">
            Each entry sends the chosen template from this number to the chosen audience.
          </p>
          <WaButton onClick={handleAdd} disabled={!activeProjectId}>
            Add to queue
          </WaButton>
        </div>
      </Section>

      {/* ── Queue ────────────────────────────────────────────────── */}
      <div className="mt-6">
        <Section
          title="2 / Broadcast queue"
          description="Each entry fires the chosen template from its phone number to its own audience."
          action={
            queue.length > 0 ? (
              <span className="text-[11.5px] tabular-nums text-zinc-500">
                {pendingCount} pending / {queue.length} total
              </span>
            ) : null
          }
          padded={false}
        >
          {queue.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Timer}
                title="Queue is empty"
                description="Use the form above to add phone + audience pairs, then hit Start cron."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {queue.map((entry, i) => (
                <m.li
                  key={entry.id}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.02 + i * 0.035, ease: EASE_OUT }}
                  className="grid grid-cols-1 items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 sm:grid-cols-[1.6fr_1.4fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-900">{entry.phoneLabel}</p>
                  </div>
                  <div className="min-w-0">
                    {entry.audienceType === 'tags' ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.tagNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700"
                          >
                            <TagIcon className="h-2.5 w-2.5" strokeWidth={2.25} />
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
                        <FileText className="h-3 w-3" strokeWidth={2.25} />
                        {entry.csvFile?.name ?? 'file'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <StatusPill tone={statusTone(entry.status)}>
                      <span className="inline-flex items-center gap-1">
                        {entry.status === 'starting' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                        {statusLabel(entry.status)}
                      </span>
                    </StatusPill>
                    {entry.error && (
                      <span className="max-w-[260px] text-[10.5px] leading-tight text-rose-600">{entry.error}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {entry.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.id)}
                        aria-label="Remove"
                        className="grid h-7 w-7 place-items-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Composer form ─────────────────────────────────────────── */}
      <form ref={composerRef} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="projectId" value={activeProjectId ?? ''} />
        <input type="hidden" name="broadcastType" value="template" />
        <input type="hidden" name="createContacts" value={createContacts ? 'true' : 'false'} />
        <input type="hidden" name="templateId" value={selectedTemplate?._id.toString() ?? ''} />

        {selectedTemplate && (
          <Section
            title="Template variables"
            description="These values apply to every entry queued above."
          >
            <TemplateInputRenderer template={selectedTemplate} variableOptions={TAG_VARIABLE_HINTS} />
          </Section>
        )}

        <Section title="Options">
          <label className="flex cursor-pointer select-none items-start gap-3">
            <input
              type="checkbox"
              checked={createContacts}
              onChange={(e) => setCreateContacts(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
              style={{ accentColor: 'var(--mt-accent)' }}
            />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-zinc-900">Create contacts in CRM</span>
              <span className="mt-0.5 text-[11.5px] text-zinc-500">
                {createContacts
                  ? 'New recipients will be added to your CRM as they receive this broadcast.'
                  : 'Off. Only existing contacts will be updated.'}
              </span>
            </div>
          </label>
        </Section>
      </form>
    </WaPage>
  );
}

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
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
        active ? 'border-emerald-300 bg-emerald-50/60' : 'border-zinc-200 bg-white hover:bg-zinc-50',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium leading-tight text-zinc-900">{label}</span>
        <span className="mt-0.5 text-[11px] leading-tight text-zinc-500">{description}</span>
      </div>
    </label>
  );
}
