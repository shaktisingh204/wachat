'use client';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  EmptyState,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  Radio,
  SelectField as Select,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { WithId } from 'mongodb';
import {
  Check,
  ChevronsUpDown,
  Download,
  FileText,
  Send,
  Tag as TagIcon,
  Upload,
  } from 'lucide-react';

import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import type { Template,
  Tag,
  MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

/**
 * BroadcastForm (wachat-local, 20ui)
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
 * version. Visual layer is fully 20ui.
 */

import * as React from 'react';

import { SabFileToFileButton } from '@/components/sabfiles';

import { TemplateInputRenderer } from './template-input-renderer';
import { BroadcastLaunchOverlay } from '@/components/wachat/broadcasts/launch-overlay';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      const allRows: any[][] = [];
      worksheet?.eachRow((row) => { allRows.push((row.values as any[]).slice(1)); });

      if (allRows.length > 0) {
        headers = allRows[0].map((h: any) => String(h));
        const headerRow = allRows[0] as string[];
        rows = allRows.slice(1).map((row: any[]) => {
          const rowData: any = {};
          headerRow.forEach((h: string, i: number) => { rowData[h] = row[i]; });
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
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={pending || disabled}
      iconLeft={Send}
      loading={pending}
    >
      {pending ? 'Queueing broadcast…' : 'Start broadcast'}
    </Button>
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
  const { toast } = useToast();
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
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Queued', description: state.message });
      setLaunched(true);
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
        tone: 'danger',
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

  const acceptFile = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
      setValidationErrors([]);
      setVariableOptions([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file =
      e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    acceptFile(file);
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

  const handleTemplateChange = (templateId: string | null) => {
    const template = templates.find((t) => t._id.toString() === templateId);
    setSelectedTemplate(template || null);
  };

  const handleFlowChange = (flowId: string | null) => {
    const flow = metaFlows.find((f) => f._id.toString() === flowId);
    setSelectedFlow(flow || null);
  };

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  const phoneOptions = (activeProject?.phoneNumbers || []).map((phone) => ({
    value: phone.id,
    label: `${phone.display_phone_number} · ${phone.verified_name}`,
  }));

  const templateOptions = approvedTemplates.map((template) => {
    const status = template.status
      ? template.status.replace(/_/g, ' ').toLowerCase()
      : 'n/a';
    return {
      value: template._id.toString(),
      label: `${template.name} · ${status}`,
    };
  });

  const flowOptions = metaFlows.map((flow) => ({
    value: flow._id.toString(),
    label: flow.name,
  }));

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-7">
      <BroadcastLaunchOverlay show={launched} onDone={() => setLaunched(false)} />
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
      {/* 20ui Select is a button widget — mirror its value into a hidden input
          so the server action keeps reading these fields from FormData. */}
      <input type="hidden" name="phoneNumberId" value={selectedPhoneNumber} />
      {broadcastType === 'template' ? (
        <input
          type="hidden"
          name="templateId"
          value={selectedTemplate?._id.toString() || ''}
        />
      ) : (
        <input
          type="hidden"
          name="flowId"
          value={selectedFlow?._id.toString() || ''}
        />
      )}
      {selectedTagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      {/* ── Steps 1 + 2: Type + Phone number ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={1} label="Broadcast type" />
          <RadioGroup
            value={broadcastType}
            onValueChange={(v) =>
              setBroadcastType(v as 'template' | 'flow')
            }
            orientation="horizontal"
            aria-label="Broadcast type"
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
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <StepLabel step={2} label="Send from" />
          <Select
            value={selectedPhoneNumber || null}
            onChange={(v) => setSelectedPhoneNumber(v ?? '')}
            options={phoneOptions}
            placeholder="Choose a number…"
            aria-label="Send-from number"
          />
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
          templateOptions.length > 0 ? (
            <Select
              value={selectedTemplate?._id.toString() || null}
              onChange={handleTemplateChange}
              options={templateOptions}
              placeholder="Choose an approved template…"
              searchable
              aria-label="Template"
            />
          ) : (
            <EmptyState
              title="No approved templates"
              description="Sync with Meta or create a new one."
              className="py-4"
            />
          )
        ) : flowOptions.length > 0 ? (
          <Select
            value={selectedFlow?._id.toString() || null}
            onChange={handleFlowChange}
            options={flowOptions}
            placeholder="Choose a flow…"
            searchable
            aria-label="Interactive flow"
          />
        ) : (
          <EmptyState
            title="No flows found"
            description="Sync with Meta or create a new one."
            className="py-4"
          />
        )}
      </div>

      {/* ── Step 4: Flow-only entry message ── */}
      {broadcastType === 'flow' && (
        <Card variant="outlined" padding="md">
          <CardHeader>
            <CardTitle>Flow entry message</CardTitle>
            <CardDescription>
              Define how the flow entry message looks to the user.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Header" id="flowHeader">
                <Input
                  name="flowHeader"
                  id="flowHeader"
                  placeholder="Start your application"
                />
              </Field>
              <Field label="Body text" required id="flowBody">
                <Input
                  name="flowBody"
                  id="flowBody"
                  placeholder="Click below to begin…"
                  required
                />
              </Field>
              <Field label="Footer" id="flowFooter">
                <Input
                  name="flowFooter"
                  id="flowFooter"
                  placeholder="Wachat"
                />
              </Field>
              <Field label="CTA button" required id="flowCta">
                <Input
                  name="flowCta"
                  id="flowCta"
                  placeholder="Open App"
                  required
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Step 5: Audience ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={5} label="Audience" />
          <input type="hidden" name="audienceType" value={audienceType} />
          <RadioGroup
            value={audienceType}
            onValueChange={(val) => setAudienceType(val as 'file' | 'tags')}
            orientation="horizontal"
            aria-label="Audience source"
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
          </RadioGroup>
        </div>

        {audienceType === 'file' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="csvFile"
                className="u-field__label"
              >
                Contact file <span className="u-field__req" aria-hidden="true">*</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={Download}
                onClick={handleDownloadSample}
              >
                Sample CSV
              </Button>
            </div>
            <label
              className={cx(
                'group flex cursor-pointer flex-col items-center justify-center gap-2',
                'rounded-[var(--st-radius)] border-2 border-dashed px-4 py-6 text-center transition-colors',
                selectedFile
                  ? 'border-[var(--st-text)] bg-[var(--st-surface-muted)]'
                  : 'border-[var(--st-border)] bg-[var(--st-surface)]',
              )}
            >
              <Upload
                className={cx(
                  'h-5 w-5 transition-colors',
                  selectedFile ? 'text-[var(--st-text)]' : 'text-[var(--st-text-muted)]',
                )}
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-[var(--st-text)]">
                  {selectedFile?.name || 'Click to choose a file'}
                </span>
                <span className="text-[11px] text-[var(--st-text-muted)]">
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
            <div className="mt-1 flex justify-end">
              <SabFileToFileButton
                accept="document"
                onPickFile={(file) => {
                  acceptFile(file);
                }}
                onError={(err) =>
                  toast({
                    title: 'Pick failed',
                    description: err.message,
                    tone: 'danger',
                  })
                }
              >
                Pick from SabFiles
              </SabFileToFileButton>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--st-text-muted)]">
              For variables, use column names that match your template (e.g.{' '}
              <code className="rounded-[3px] bg-[var(--st-surface-muted)] px-1 font-mono text-[10px] text-[var(--st-text)]">
                variable1
              </code>
              ).
            </p>

            {isValidating ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--st-accent)]">
                <Spinner size="sm" aria-hidden="true" />
                Validating file…
              </p>
            ) : null}

            {validationErrors.length > 0 && (
              <Alert tone="danger" title="File error" className="mt-2">
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px]">
                  {validationErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validationErrors.length > 5 && (
                    <li>…and {validationErrors.length - 5} more issues.</li>
                  )}
                </ul>
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="u-field__label">Contact tags</span>
            <Popover
              open={tagPopoverOpen}
              onOpenChange={setTagPopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={tagPopoverOpen}
                  aria-label="Select contact tags"
                  className={cx(
                    'inline-flex h-10 w-full items-center justify-between gap-2 rounded-[var(--st-radius)] border px-3 text-[13px] transition-colors',
                    'border-[var(--st-border)] bg-[var(--st-bg)]',
                    selectedTagIds.length === 0
                      ? 'text-[var(--st-text-muted)]'
                      : 'text-[var(--st-text)]',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {selectedTagIds.length > 0
                      ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'} selected`
                      : 'Select tags…'}
                  </span>
                  <ChevronsUpDown
                    className="h-4 w-4 shrink-0 opacity-50"
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search tags…" />
                  <CommandList>
                    <CommandEmpty>No tags found.</CommandEmpty>
                    <CommandGroup>
                      {(activeProject?.tags || []).map((tag: Tag) => {
                        const isSelected = selectedTagIds.includes(tag._id);
                        return (
                          <CommandItem
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
                              className={cx(
                                'mr-2 flex h-4 w-4 items-center justify-center rounded-[3px] border',
                                isSelected
                                  ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                                  : 'border-[var(--st-border)] bg-transparent',
                              )}
                            >
                              {isSelected ? (
                                <Check
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </span>
                            {/* data-driven colour — kept as inline style */}
                            <span
                              className="mr-2 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span>{tag.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="mt-0.5 text-[11px] text-[var(--st-text-muted)]">
              Send this broadcast to every contact matching one or more of
              these tags.
            </p>
          </div>
        )}
      </div>

      {/* ── Step 6: Template variables ── */}
      {broadcastType === 'template' && selectedTemplate && (
        <div className="flex flex-col gap-3">
          <StepLabel step={6} label="Template variables" />
          <Card variant="outlined" padding="md">
            <TemplateInputRenderer
              template={selectedTemplate}
              variableOptions={variableOptions}
            />
          </Card>
        </div>
      )}

      {/* ── Options ── */}
      <Card variant="outlined" padding="none">
        <div className="flex items-center gap-3 px-5 py-3">
          <Checkbox
            checked={createContacts}
            onChange={(e) => setCreateContacts(e.target.checked)}
            label={
              <span className="text-[12px] text-[var(--st-text)]">
                Create contacts in CRM
              </span>
            }
          />
          <span className="text-[10px] text-[var(--st-text-muted)]">
            {createContacts
              ? 'New contacts will be added for each recipient not already in your CRM.'
              : 'Off -- only existing contacts will be updated. No new contacts created.'}
          </span>
        </div>
      </Card>

      {/* ── Submit ── */}
      <div className="flex flex-col items-stretch gap-3 border-t border-[var(--st-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-muted)]">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {selectedFile ? (
            <span>
              Ready:{' '}
              <span className="text-[var(--st-text)]">
                {selectedFile.name}
              </span>{' '}
              {validationErrors.length > 0 ? (
                <span className="text-[var(--st-danger)]">
                  · {validationErrors.length} issue
                  {validationErrors.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="text-[var(--st-success)]">· validated</span>
              )}
            </span>
          ) : audienceType === 'tags' && selectedTagIds.length > 0 ? (
            <span>
              Audience:{' '}
              <span className="text-[var(--st-text)]">
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
    <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-text)] text-[10px] tabular-nums text-[var(--st-text-inverted)]">
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
      className={cx(
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-[var(--st-radius)] border px-3 py-2.5 transition-colors',
        active
          ? 'border-[var(--st-text)] bg-[var(--st-surface-muted)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)]',
      )}
    >
      <Radio value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] leading-tight text-[var(--st-text)]">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-tight text-[var(--st-text-muted)]">
          {description}
        </span>
      </div>
    </label>
  );
}
