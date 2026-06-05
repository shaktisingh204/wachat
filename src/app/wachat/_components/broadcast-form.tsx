'use client';

import {
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  Radio,
  Select,
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
      iconLeft={pending ? Loader2 : Send}
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
            <div
              className="rounded-[var(--st-radius)] border border-dashed px-2 py-4 text-center text-[12px]"
              style={{
                borderColor: 'var(--st-border)',
                color: 'var(--st-text-muted)',
              }}
            >
              No approved templates found. Sync with Meta or create a new one.
            </div>
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
          <div
            className="rounded-[var(--st-radius)] border border-dashed px-2 py-4 text-center text-[12px]"
            style={{
              borderColor: 'var(--st-border)',
              color: 'var(--st-text-muted)',
            }}
          >
            No flows found. Sync with Meta or create a new one.
          </div>
        )}
      </div>

      {/* ── Step 4: Flow-only entry message ── */}
      {broadcastType === 'flow' && (
        <div
          className="grid gap-4 rounded-[var(--st-radius)] border p-5 md:grid-cols-2"
          style={{
            borderColor: 'var(--st-border)',
            background: 'var(--st-surface)',
          }}
        >
          <div className="md:col-span-2">
            <span
              className="text-[11.5px] uppercase tracking-wide"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Flow entry message
            </span>
            <p
              className="mt-0.5 text-[11.5px]"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Define how the flow entry message looks to the user.
            </p>
          </div>
          <Field label="Header" optional htmlFor="flowHeader">
            <Input
              name="flowHeader"
              id="flowHeader"
              placeholder="Start your application"
            />
          </Field>
          <Field label="Body text" required htmlFor="flowBody">
            <Input
              name="flowBody"
              id="flowBody"
              placeholder="Click below to begin…"
              required
            />
          </Field>
          <Field label="Footer" optional htmlFor="flowFooter">
            <Input
              name="flowFooter"
              id="flowFooter"
              placeholder="Wachat"
            />
          </Field>
          <Field label="CTA button" required htmlFor="flowCta">
            <Input
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
                className="text-[11.5px] uppercase tracking-wide"
                style={{ color: 'var(--st-text-muted)' }}
              >
                Contact file{' '}
                <span className="ml-1" style={{ color: 'var(--st-danger)' }}>
                  *
                </span>
              </label>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1 text-[11px] transition-colors"
                style={{ color: 'var(--st-text-muted)' }}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                Sample CSV
              </button>
            </div>
            <label
              className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius)] border-2 border-dashed px-4 py-6 text-center transition-colors"
              style={{
                borderColor: selectedFile
                  ? 'var(--st-text)'
                  : 'var(--st-border)',
                background: selectedFile
                  ? 'var(--st-surface-muted)'
                  : 'var(--st-surface)',
              }}
            >
              <Upload
                className="h-5 w-5 transition-colors"
                style={{
                  color: selectedFile
                    ? 'var(--st-text)'
                    : 'var(--st-text-muted)',
                }}
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-[13px]"
                  style={{ color: 'var(--st-text)' }}
                >
                  {selectedFile?.name || 'Click to choose a file'}
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--st-text-muted)' }}
                >
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
            <div
              className="mt-0.5 text-[11px]"
              style={{ color: 'var(--st-text-muted)' }}
            >
              For variables, use column names that match your template (e.g.{' '}
              <code
                className="rounded-[3px] px-1 font-mono text-[10px]"
                style={{
                  background: 'var(--st-surface-muted)',
                  color: 'var(--st-text)',
                }}
              >
                variable1
              </code>
              ).
            </div>

            {isValidating ? (
              <p
                className="mt-1 inline-flex items-center gap-1.5 text-[11.5px]"
                style={{ color: 'var(--st-accent)' }}
              >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Validating file…
              </p>
            ) : null}

            {validationErrors.length > 0 && (
              <div
                className="mt-2 rounded-[var(--st-radius)] border p-3"
                style={{
                  borderColor: 'var(--st-danger)',
                  background: 'var(--st-danger-soft)',
                }}
              >
                <div
                  className="flex items-center gap-2 text-[12px]"
                  style={{ color: 'var(--st-danger)' }}
                >
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  File error
                </div>
                <ul
                  className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px]"
                  style={{ color: 'var(--st-danger)' }}
                >
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
            <span
              className="text-[11.5px] uppercase tracking-wide"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Contact tags
            </span>
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
                  className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-[var(--st-radius)] border px-3 text-[13px] transition-colors"
                  style={{
                    borderColor: 'var(--st-border)',
                    background: 'var(--st-bg)',
                    color:
                      selectedTagIds.length === 0
                        ? 'var(--st-text-muted)'
                        : 'var(--st-text)',
                  }}
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
                              className="mr-2 flex h-4 w-4 items-center justify-center rounded-[3px] border"
                              style={{
                                borderColor: isSelected
                                  ? 'var(--st-text)'
                                  : 'var(--st-border)',
                                background: isSelected
                                  ? 'var(--st-text)'
                                  : 'transparent',
                                color: 'var(--st-text-inverted)',
                              }}
                            >
                              {isSelected ? (
                                <Check
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </span>
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
            <div
              className="mt-0.5 text-[11px]"
              style={{ color: 'var(--st-text-muted)' }}
            >
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
          <div
            className="rounded-[var(--st-radius)] border p-5"
            style={{
              borderColor: 'var(--st-border)',
              background: 'var(--st-surface)',
            }}
          >
            <TemplateInputRenderer
              template={selectedTemplate}
              variableOptions={variableOptions}
            />
          </div>
        </div>
      )}

      {/* ── Options ── */}
      <div
        className="flex items-center gap-3 rounded-[var(--st-radius)] border px-5 py-3"
        style={{
          borderColor: 'var(--st-border)',
          background: 'var(--st-surface)',
        }}
      >
        <Checkbox
          checked={createContacts}
          onChange={(e) => setCreateContacts(e.target.checked)}
          label={
            <span className="text-[12px]" style={{ color: 'var(--st-text)' }}>
              Create contacts in CRM
            </span>
          }
        />
        <span className="text-[10px]" style={{ color: 'var(--st-text-muted)' }}>
          {createContacts
            ? 'New contacts will be added for each recipient not already in your CRM.'
            : 'Off — only existing contacts will be updated. No new contacts created.'}
        </span>
      </div>

      {/* ── Submit ── */}
      <div
        className="flex flex-col items-stretch gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'var(--st-border)' }}
      >
        <div
          className="flex items-center gap-2 text-[11.5px]"
          style={{ color: 'var(--st-text-muted)' }}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {selectedFile ? (
            <span>
              Ready:{' '}
              <span style={{ color: 'var(--st-text)' }}>
                {selectedFile.name}
              </span>{' '}
              {validationErrors.length > 0 ? (
                <span style={{ color: 'var(--st-danger)' }}>
                  · {validationErrors.length} issue
                  {validationErrors.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span style={{ color: 'var(--st-success)' }}>· validated</span>
              )}
            </span>
          ) : audienceType === 'tags' && selectedTagIds.length > 0 ? (
            <span>
              Audience:{' '}
              <span style={{ color: 'var(--st-text)' }}>
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
    <span
      className="inline-flex items-center gap-2 text-[12.5px]"
      style={{ color: 'var(--st-text)' }}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] tabular-nums"
        style={{
          background: 'var(--st-text)',
          color: 'var(--st-text-inverted)',
        }}
      >
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
      className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-[var(--st-radius)] border px-3 py-2.5 transition-colors"
      style={{
        borderColor: active ? 'var(--st-text)' : 'var(--st-border)',
        background: active ? 'var(--st-surface-muted)' : 'var(--st-bg)',
      }}
    >
      <Radio value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span
          className="text-[13px] leading-tight"
          style={{ color: 'var(--st-text)' }}
        >
          {label}
        </span>
        <span
          className="mt-0.5 text-[11px] leading-tight"
          style={{ color: 'var(--st-text-muted)' }}
        >
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
      <label
        htmlFor={htmlFor}
        className="text-[11.5px] uppercase tracking-wide"
        style={{ color: 'var(--st-text-muted)' }}
      >
        {label}
        {required ? (
          <span className="ml-1" style={{ color: 'var(--st-danger)' }}>
            *
          </span>
        ) : null}
        {optional ? (
          <span className="ml-1" style={{ color: 'var(--st-text-tertiary)' }}>
            (optional)
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
