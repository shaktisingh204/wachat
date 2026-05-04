'use client';

/**
 * BroadcastForm (wachat-local, ZoruUI)
 *
 * The WhatsApp campaign composer. 6 numbered steps on a single form:
 *   1. Type             (Message template vs. Interactive flow)
 *   2. Send-from number
 *   3. Content          (template picker or flow picker)
 *   4. Flow entry msg   (only if type=flow)
 *   5. Audience         (CSV/XLSX upload OR tag segment)
 *   6. Template vars    (derived from selected template + CSV headers)
 *
 * All CSV/XLSX validation, tag-popover behavior, and server-action
 * wiring (handleStartBroadcast) are preserved 1:1 from the wabasimplify
 * version. Visual layer is fully Zoru.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import type { WithId } from 'mongodb';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Download,
  FileText,
  Loader2,
  Send,
  Tag as TagIcon,
  Upload,
} from 'lucide-react';

import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import type { Template, Tag, MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import {
  ZoruButton,
  ZoruCheckbox,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruInput,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';

import { TemplateInputRenderer } from './template-input-renderer';

/* ══════════════════════════════════════════════════════════════════
 *  Helpers (CSV/XLSX parse + validation, unchanged)
 * ══════════════════════════════════════════════════════════════════ */

const initialState = {
  message: undefined,
  error: undefined,
};

const extractRequiredVariables = (template: WithId<Template>): string[] => {
  const variableIndices = new Set<number>();
  const regex = /{{(\d+)}}/g;
  const templateString = JSON.stringify(template);
  let match;
  while ((match = regex.exec(templateString)) !== null) {
    variableIndices.add(parseInt(match[1], 10));
  }
  return Array.from(variableIndices)
    .sort((a, b) => a - b)
    .map((i) => `variable${i}`);
};

const validateFileContent = async (
  file: File,
  requiredVars: string[],
): Promise<{ errors: string[]; headers: string[] }> => {
  const errors: string[] = [];
  let rows: any[] = [];
  let headers: string[] = [];

  try {
    const buffer = await file.arrayBuffer();

    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(buffer);
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = result.data;
      if (result.errors && result.errors.length > 0) {
        errors.push(`CSV parse error: ${result.errors[0].message}`);
        return { errors, headers };
      }
      if (result.meta.fields) {
        headers = result.meta.fields;
      }
    } else {
      const data = new Uint8Array(buffer);
      const workbook = xlsx.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });

      if (rows.length > 0) {
        headers = (rows[0] as string[]).map((h) => String(h));
        const headerRow = rows[0] as string[];
        rows = rows.slice(1).map((row: any) => {
          const rowData: any = {};
          headerRow.forEach((h: string, i: number) => {
            rowData[h] = row[i];
          });
          return rowData;
        });
      }
    }

    if (rows.length === 0) {
      errors.push('The file is empty.');
      return { errors, headers };
    }

    const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

    if (!lowerHeaders.includes('phone')) {
      errors.push("Missing required column: 'phone'");
    }

    const missingVars = requiredVars.filter(
      (v) => !lowerHeaders.includes(v.toLowerCase()),
    );
    if (missingVars.length > 0) {
      errors.push(`Missing variable columns: ${missingVars.join(', ')}`);
    }

    if (errors.length > 0) return { errors, headers };

    rows.forEach((row, index) => {
      if (errors.length >= 5) return;

      if (!row.phone && !row.Phone && !row.PHONE) {
        errors.push(`Row ${index + 2}: Missing phone number.`);
      }

      requiredVars.forEach((v) => {
        const key = Object.keys(row).find(
          (k) => k.toLowerCase() === v.toLowerCase(),
        );
        const val = key ? row[key] : undefined;

        if (!val || String(val).trim() === '') {
          errors.push(`Row ${index + 2}: Missing value for ${v}`);
        }
      });
    });
  } catch (e: any) {
    errors.push(`Failed to validate file: ${e.message}`);
  }

  return { errors, headers };
};

/* ══════════════════════════════════════════════════════════════════
 *  Submit button
 * ══════════════════════════════════════════════════════════════════ */

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="lg" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {pending ? 'Queueing broadcast…' : 'Start broadcast'}
    </ZoruButton>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  Main component
 * ══════════════════════════════════════════════════════════════════ */

interface BroadcastFormProps {
  templates: WithId<Template>[];
  metaFlows: WithId<MetaFlow>[];
  onSuccess: () => void;
}

export function BroadcastForm({
  templates,
  metaFlows,
  onSuccess,
}: BroadcastFormProps) {
  const { activeProject } = useProject();
  const [state, formAction] = useActionState(
    handleStartBroadcast,
    initialState,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [audienceType, setAudienceType] = useState<'file' | 'tags'>('file');
  const [createContacts, setCreateContacts] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'template' | 'flow'>(
    'template',
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<WithId<Template> | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<WithId<MetaFlow> | null>(
    null,
  );
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const [variableOptions, setVariableOptions] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Queued', description: state.message });
      formRef.current?.reset();
      setSelectedFile(null);
      setFileInputKey(Date.now());
      setSelectedTagIds([]);
      onSuccess();
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSuccess]);

  useEffect(() => {
    const validateAndExtract = async () => {
      if (audienceType === 'tags') {
        setVariableOptions([
          'name',
          'phone',
          'email',
          'custom_field_1',
          'custom_field_2',
          'custom_field_3',
        ]);
        setValidationErrors([]);
        return;
      }

      if (!selectedFile) {
        setValidationErrors([]);
        setVariableOptions([]);
        return;
      }

      let requiredVars: string[] = [];
      if (broadcastType === 'template' && selectedTemplate) {
        requiredVars = extractRequiredVariables(selectedTemplate);
      }

      setIsValidating(true);
      const { errors, headers } = await validateFileContent(
        selectedFile,
        requiredVars,
      );
      setValidationErrors(errors);
      setVariableOptions(headers || []);
      setIsValidating(false);
    };

    validateAndExtract();
  }, [selectedFile, selectedTemplate, broadcastType, audienceType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
      setValidationErrors([]);
      setVariableOptions([]);
    }
  };

  const handleDownloadSample = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'phone,name,variable1,variable2\n' +
      '919876543210,John Doe,your order,today\n' +
      '919876543211,Jane Smith,our latest offer,tomorrow';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Sample file downloading…' });
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t._id.toString() === templateId);
    setSelectedTemplate(template || null);
  };

  const handleFlowChange = (flowId: string) => {
    const flow = metaFlows.find((f) => f._id.toString() === flowId);
    setSelectedFlow(flow || null);
  };

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-7">
      <input
        type="hidden"
        name="projectId"
        value={activeProject?._id?.toString()}
      />
      <input type="hidden" name="broadcastType" value={broadcastType} />
      <input
        type="hidden"
        name="createContacts"
        value={createContacts ? 'true' : 'false'}
      />
      {selectedTagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      {/* ── Steps 1 + 2: Type + Phone number ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={1} label="Broadcast type" />
          <ZoruRadioGroup
            value={broadcastType}
            onValueChange={(v) =>
              setBroadcastType(v as 'template' | 'flow')
            }
            className="flex gap-3"
          >
            <TypeOption
              value="template"
              id="type-template"
              label="Message template"
              description="Pre-approved text, media or carousel"
              active={broadcastType === 'template'}
            />
            <TypeOption
              value="flow"
              id="type-flow"
              label="Interactive flow"
              description="Multi-step form experience"
              active={broadcastType === 'flow'}
            />
          </ZoruRadioGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <StepLabel step={2} label="Send from" />
          <ZoruSelect
            name="phoneNumberId"
            value={selectedPhoneNumber}
            onValueChange={setSelectedPhoneNumber}
          >
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Choose a number…" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {(activeProject?.phoneNumbers || []).map((phone) => (
                <ZoruSelectItem key={phone.id} value={phone.id}>
                  {phone.display_phone_number} · {phone.verified_name}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </div>

      {/* ── Step 3: Content selection ── */}
      <div className="flex flex-col gap-1.5">
        <StepLabel
          step={3}
          label={
            broadcastType === 'template' ? 'Template' : 'Interactive flow'
          }
        />
        {broadcastType === 'template' ? (
          <ZoruSelect
            name="templateId"
            value={selectedTemplate?._id.toString() || ''}
            onValueChange={handleTemplateChange}
          >
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Choose an approved template…" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {approvedTemplates.length > 0 ? (
                approvedTemplates.map((template) => (
                  <ZoruSelectItem
                    key={template._id.toString()}
                    value={template._id.toString()}
                  >
                    {template.name}
                    <span className="ml-2 text-[11px] capitalize text-zoru-ink-muted">
                      {template.status
                        ? template.status
                            .replace(/_/g, ' ')
                            .toLowerCase()
                        : 'n/a'}
                    </span>
                  </ZoruSelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                  No approved templates found. Sync with Meta or create a new
                  one.
                </div>
              )}
            </ZoruSelectContent>
          </ZoruSelect>
        ) : (
          <ZoruSelect
            name="flowId"
            value={selectedFlow?._id.toString() || ''}
            onValueChange={handleFlowChange}
          >
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Choose a flow…" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {metaFlows.length > 0 ? (
                metaFlows.map((flow) => (
                  <ZoruSelectItem
                    key={flow._id.toString()}
                    value={flow._id.toString()}
                  >
                    {flow.name}
                  </ZoruSelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                  No flows found. Sync with Meta or create a new one.
                </div>
              )}
            </ZoruSelectContent>
          </ZoruSelect>
        )}
      </div>

      {/* ── Step 4: Flow-only entry message ── */}
      {broadcastType === 'flow' && (
        <div className="grid gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
              Flow entry message
            </ZoruLabel>
            <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
              Define how the flow entry message looks to the user.
            </p>
          </div>
          <Field label="Header" optional htmlFor="flowHeader">
            <ZoruInput
              name="flowHeader"
              id="flowHeader"
              placeholder="Start your application"
            />
          </Field>
          <Field label="Body text" required htmlFor="flowBody">
            <ZoruInput
              name="flowBody"
              id="flowBody"
              placeholder="Click below to begin…"
              required
            />
          </Field>
          <Field label="Footer" optional htmlFor="flowFooter">
            <ZoruInput
              name="flowFooter"
              id="flowFooter"
              placeholder="Wachat"
            />
          </Field>
          <Field label="CTA button" required htmlFor="flowCta">
            <ZoruInput
              name="flowCta"
              id="flowCta"
              placeholder="Open App"
              required
            />
          </Field>
        </div>
      )}

      {/* ── Step 5: Audience ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={5} label="Audience" />
          <input type="hidden" name="audienceType" value={audienceType} />
          <ZoruRadioGroup
            value={audienceType}
            onValueChange={(val) => setAudienceType(val as 'file' | 'tags')}
            className="flex gap-3"
          >
            <TypeOption
              value="file"
              id="audience-file"
              label="Upload file"
              description="CSV or XLSX"
              active={audienceType === 'file'}
            />
            <TypeOption
              value="tags"
              id="audience-tags"
              label="From tags"
              description="Existing segments"
              active={audienceType === 'tags'}
            />
          </ZoruRadioGroup>
        </div>

        {audienceType === 'file' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Contact file <span className="ml-1 text-zoru-danger">*</span>
              </ZoruLabel>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
              >
                <Download className="h-3 w-3" />
                Sample CSV
              </button>
            </div>
            <label
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius)] border-2 border-dashed px-4 py-6 text-center transition-colors',
                selectedFile
                  ? 'border-zoru-ink bg-zoru-surface-2'
                  : 'border-zoru-line bg-zoru-surface hover:bg-zoru-surface-2',
              )}
            >
              <Upload
                className={cn(
                  'h-5 w-5 transition-colors',
                  selectedFile ? 'text-zoru-ink' : 'text-zoru-ink-muted',
                )}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-zoru-ink">
                  {selectedFile?.name || 'Click to choose a file'}
                </span>
                <span className="text-[11px] text-zoru-ink-muted">
                  {selectedFile ? 'Click to replace' : 'CSV or XLSX'}
                </span>
              </div>
              <input
                key={fileInputKey}
                id="csvFile"
                name="csvFile"
                type="file"
                accept=".csv,.xlsx"
                required
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
              For variables, use column names that match your template (e.g.{' '}
              <code className="rounded-[3px] bg-zoru-surface-2 px-1 font-mono text-[10px] text-zoru-ink">
                variable1
              </code>
              ).
            </div>

            {isValidating ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-zoru-info">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating file…
              </p>
            ) : null}

            {validationErrors.length > 0 && (
              <div className="mt-2 rounded-[var(--zoru-radius)] border border-zoru-danger/40 bg-zoru-danger/5 p-3">
                <div className="flex items-center gap-2 text-[12px] text-zoru-danger">
                  <AlertCircle className="h-3.5 w-3.5" />
                  File error
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px] text-zoru-danger">
                  {validationErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validationErrors.length > 5 && (
                    <li>…and {validationErrors.length - 5} more issues.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
              Contact tags
            </ZoruLabel>
            <ZoruPopover
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
                      {(activeProject?.tags || []).map((tag: Tag) => {
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
            </ZoruPopover>
            <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
              Send this broadcast to every contact matching one or more of
              these tags.
            </div>
          </div>
        )}
      </div>

      {/* ── Step 6: Template variables ── */}
      {broadcastType === 'template' && selectedTemplate && (
        <div className="flex flex-col gap-3">
          <StepLabel step={6} label="Template variables" />
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-5">
            <TemplateInputRenderer
              template={selectedTemplate}
              variableOptions={variableOptions}
            />
          </div>
        </div>
      )}

      {/* ── Options ── */}
      <div className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-5 py-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <ZoruCheckbox
            checked={createContacts}
            onCheckedChange={(c) => setCreateContacts(Boolean(c))}
          />
          <span className="text-[12px] text-zoru-ink">
            Create contacts in CRM
          </span>
        </label>
        <span className="text-[10px] text-zoru-ink-muted">
          {createContacts
            ? 'New contacts will be added for each recipient not already in your CRM.'
            : 'Off — only existing contacts will be updated. No new contacts created.'}
        </span>
      </div>

      {/* ── Submit ── */}
      <div className="flex flex-col items-stretch gap-3 border-t border-zoru-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11.5px] text-zoru-ink-muted">
          <FileText className="h-3.5 w-3.5" />
          {selectedFile ? (
            <span>
              Ready:{' '}
              <span className="text-zoru-ink">{selectedFile.name}</span>{' '}
              {validationErrors.length > 0 ? (
                <span className="text-zoru-danger">
                  · {validationErrors.length} issue
                  {validationErrors.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="text-zoru-success">· validated</span>
              )}
            </span>
          ) : audienceType === 'tags' && selectedTagIds.length > 0 ? (
            <span>
              Audience:{' '}
              <span className="text-zoru-ink">
                {selectedTagIds.length} tag
                {selectedTagIds.length === 1 ? '' : 's'}
              </span>
            </span>
          ) : (
            <span>Complete the steps above to queue a broadcast.</span>
          )}
        </div>
        <SubmitButton
          disabled={
            !selectedPhoneNumber ||
            (broadcastType === 'template'
              ? !selectedTemplate
              : !selectedFlow) ||
            validationErrors.length > 0 ||
            isValidating
          }
        />
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  Local UI helpers
 * ══════════════════════════════════════════════════════════════════ */

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zoru-ink text-[10px] tabular-nums text-zoru-on-primary">
        {step}
      </span>
      {label}
    </span>
  );
}

function TypeOption({
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
          ? 'border-zoru-ink bg-zoru-surface-2'
          : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] leading-tight text-zoru-ink">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-tight text-zoru-ink-muted">
          {description}
        </span>
      </div>
    </label>
  );
}

function Field({
  label,
  required,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel
        htmlFor={htmlFor}
        className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted"
      >
        {label}
        {required ? (
          <span className="ml-1 text-zoru-danger">*</span>
        ) : null}
        {optional ? (
          <span className="ml-1 text-zoru-ink-subtle">(optional)</span>
        ) : null}
      </ZoruLabel>
      {children}
    </div>
  );
}
