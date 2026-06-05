'use client';

import {
  useToast,
  Badge,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Checkbox,
  EmptyState,
  Alert,
  Field,
  RadioCardGroup,
  RadioCard,
  Select,
  Separator,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  TagPicker,
} from '@/components/sabcrm/20ui';
import type { BadgeTone, TagOption } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import {
  FileText,
  Play,
  Timer,
  Trash2,
  Upload,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates } from '@/app/actions/template.actions';
import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import type { Template,
  Tag as TagType } from '@/lib/definitions';
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

import { WachatPage } from '@/app/wachat/_components/wachat-page';
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

function statusTone(s: EntryStatus): BadgeTone {
  if (s === 'pending') return 'neutral';
  if (s === 'starting') return 'info';
  if (s === 'started') return 'success';
  return 'danger';
}

function statusLabel(s: EntryStatus) {
  if (s === 'pending') return 'Pending';
  if (s === 'starting') return 'Starting...';
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
  const { toast } = useToast();
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

  const projectTags = (activeProject?.tags || []) as TagType[];

  // Build TagOption[] from the project's tag list for TagPicker
  const tagOptions: TagOption[] = projectTags.map((t) => ({
    id: t._id,
    label: t.name,
    color: t.color,
  }));

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
                (id) => projectTags.find((t) => t._id === id)?.name ?? id,
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
        tone: 'success',
      });
    } else if (successCount > 0) {
      toast({
        title: 'Partial success',
        description: `${successCount} queued, ${failCount} failed.`,
        tone: 'danger',
      });
    } else {
      toast({
        title: 'All failed',
        description:
          'None of the broadcasts could be queued. Check the errors below.',
        tone: 'danger',
      });
    }
  };

  /* Clear completed/failed entries */
  const handleClearDone = () => {
    setQueue((prev) => prev.filter((e) => e.status === 'pending'));
  };

  const pendingCount = queue.filter((e) => e.status === 'pending').length;

  const templateLocked = queue.length > 0;

  const handleTemplateChange = (templateId: string | null) => {
    if (templateLocked) return;
    const t = templates.find((tt) => tt._id.toString() === templateId);
    setSelectedTemplate(t || null);
  };

  const phoneOptions = (activeProject?.phoneNumbers || []).map((phone) => ({
    value: phone.id,
    label: `${phone.display_phone_number} · ${phone.verified_name}`,
  }));
  const templateOptions = approvedTemplates.map((t) => ({
    value: t._id.toString(),
    label: t.name,
  }));

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Broadcast Cron' },
      ]}
      title="Broadcast Cron"
      description="Pick one template, fill its variables once, then queue any number of phone + audience pairs and fire them all together."
      actions={
        <div className="flex items-center gap-2">
          {queue.some((e) => e.status === 'started' || e.status === 'failed') && (
            <Button variant="outline" size="sm" onClick={handleClearDone}>
              Clear done
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            iconLeft={isStarting ? undefined : Play}
            loading={isStarting}
            onClick={handleStartCron}
            disabled={isStarting || pendingCount === 0 || !selectedTemplate}
          >
            {isStarting
              ? 'Starting...'
              : `Start Cron${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Add Entry ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[16px] font-medium leading-none text-[var(--st-text)]">
              1 · Add entry
            </h2>
            <p className="mt-1.5 text-[12px] text-[var(--st-text-secondary)]">
              Pick a phone number, then the template, then this entry's audience.
            </p>
          </div>
          <Card variant="outlined" padding="lg">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Phone number */}
              <Field label="Phone Number" required>
                <Select
                  value={phoneNumberId || null}
                  onChange={(v) => setPhoneNumberId(v ?? '')}
                  options={phoneOptions}
                  placeholder={
                    phoneOptions.length === 0
                      ? 'No phone numbers on this project'
                      : 'Choose a number...'
                  }
                  disabled={phoneOptions.length === 0}
                  aria-label="Phone Number"
                />
              </Field>

              {/* Template — global; locks once any row is queued. */}
              <div className="flex flex-col gap-1.5">
                {templateLocked && (
                  <div className="flex items-center justify-end">
                    <span className="text-[10px] text-[var(--st-text-tertiary)]">
                      Locked · clear queue to switch
                    </span>
                  </div>
                )}
                <Field label="Template" required>
                  <Select
                    value={selectedTemplate?._id.toString() ?? null}
                    onChange={handleTemplateChange}
                    options={templateOptions}
                    placeholder={
                      isLoadingTemplates
                        ? 'Loading templates...'
                        : templateOptions.length === 0
                          ? 'No approved templates'
                          : 'Choose an approved template...'
                    }
                    disabled={
                      isLoadingTemplates ||
                      templateLocked ||
                      templateOptions.length === 0
                    }
                    searchable
                    aria-label="Template"
                  />
                </Field>
              </div>
            </div>

            {/* Audience type */}
            <div className="mt-5">
              <Field label="Audience" required>
                <RadioCardGroup
                  value={audienceType}
                  onChange={(v) => setAudienceType(v as AudienceKind)}
                  label="Audience"
                  className="flex gap-2"
                >
                  <RadioCard
                    value="tags"
                    label="From tags"
                    description="Existing segments"
                  />
                  <RadioCard
                    value="file"
                    label="Upload file"
                    description="CSV or XLSX"
                  />
                </RadioCardGroup>
              </Field>
            </div>

            {/* Audience inputs */}
            <div className="mt-5">
              {audienceType === 'tags' ? (
                <Field label="Audience Tags" required>
                  <TagPicker
                    options={tagOptions}
                    value={selectedTagIds}
                    onChange={(ids) => setSelectedTagIds(ids)}
                    placeholder="Select tags..."
                    searchPlaceholder="Search tags..."
                    aria-label="Select audience tags"
                  />
                </Field>
              ) : (
                <Field
                  label="Contact file"
                  required
                  help={
                    <>
                      Required columns: <code>phone</code>, plus a column per
                      template variable (e.g. <code>variable1</code>).
                    </>
                  }
                >
                  <div
                    className={[
                      'flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--st-radius)] border border-dashed',
                      csvFile
                        ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg)]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {csvFile ? (
                        <FileText
                          className="h-4 w-4 text-[var(--st-accent)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Upload
                          className="h-4 w-4 text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate text-[13px] text-[var(--st-text)]">
                        {csvFile?.name ??
                          'Pick a CSV or XLSX file from SabFiles'}
                      </span>
                    </div>
                    <SabFileToFileButton
                      accept="document"
                      onPickFile={(file) => setCsvFile(file)}
                      onError={(err) =>
                        toast({
                          title: 'Pick failed',
                          description: err.message,
                          tone: 'danger',
                        })
                      }
                    >
                      {csvFile ? 'Replace' : 'Pick from SabFiles'}
                    </SabFileToFileButton>
                  </div>
                </Field>
              )}
            </div>

            {/* Validation error */}
            {addError && (
              <div className="mt-3">
                <Alert tone="danger">{addError}</Alert>
              </div>
            )}

            <div className="mt-5">
              <Separator />
              <div className="flex items-center justify-between pt-4">
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                  Each entry sends the chosen template (with variables and media
                  set in the cards below) from this number to the chosen audience.
                </p>
                <Button
                  variant="primary"
                  onClick={handleAdd}
                  disabled={!activeProjectId}
                >
                  Add to Queue
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* ── Queue ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-medium leading-none text-[var(--st-text)]">
                2 · Broadcast queue
              </h2>
              <p className="mt-1.5 text-[12px] text-[var(--st-text-secondary)]">
                Each entry fires the chosen template from its phone number to
                its own audience.
              </p>
            </div>
            {queue.length > 0 && (
              <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                {pendingCount} pending · {queue.length} total
              </span>
            )}
          </div>
          {queue.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="Queue is empty"
              description="Use the form above to add phone + audience pairs, then hit Start Cron."
            />
          ) : (
            <Card variant="outlined" padding="none" className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>Phone Number</Th>
                    <Th>Audience</Th>
                    <Th>Status</Th>
                    <Th align="right">Action</Th>
                  </Tr>
                </THead>
                <TBody>
                  {queue.map((entry) => (
                    <Tr key={entry.id}>
                      <Td>{entry.phoneLabel}</Td>
                      <Td>
                        {entry.audienceType === 'tags' ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.tagNames.map((name) => (
                              <Badge key={name} tone="neutral">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
                            <FileText
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            {entry.csvFile?.name ?? 'file'}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          <Badge tone={statusTone(entry.status)}>
                            {entry.status === 'starting' && (
                              <Spinner size={10} label="Starting" />
                            )}
                            {statusLabel(entry.status)}
                          </Badge>
                          {entry.error && (
                            <span className="text-[10.5px] leading-tight max-w-[260px] text-[var(--st-danger)]">
                              {entry.error}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td align="right">
                        {entry.status === 'pending' && (
                          <IconButton
                            label="Remove"
                            icon={Trash2}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(entry.id)}
                          />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
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
            <Card variant="outlined" padding="lg">
              <CardHeader>
                <CardTitle>Template variables</CardTitle>
                <CardDescription>
                  These values apply to every entry queued above.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <TemplateInputRenderer
                  template={selectedTemplate}
                  variableOptions={TAG_VARIABLE_HINTS}
                />
              </CardBody>
            </Card>
          )}

          {/* Options */}
          <Card variant="outlined" padding="md">
            <div className="flex items-start gap-3 cursor-pointer select-none">
              <Checkbox
                checked={createContacts}
                onChange={(e) => setCreateContacts(e.target.checked)}
                className="mt-0.5"
                aria-label="Create contacts in CRM"
                id="create-contacts-checkbox"
              />
              <div className="flex flex-col">
                <label
                  htmlFor="create-contacts-checkbox"
                  className="text-[13px] font-medium cursor-pointer text-[var(--st-text)]"
                >
                  Create contacts in CRM
                </label>
                <span className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                  {createContacts
                    ? 'New recipients will be added to your CRM as they receive this broadcast.'
                    : 'Off - only existing contacts will be updated.'}
                </span>
              </div>
            </div>
          </Card>
        </form>
      </div>
    </WachatPage>
  );
}
