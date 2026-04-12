'use client';

/**
 * BroadcastForm — the WhatsApp broadcast composer, rebuilt on Clay.
 *
 * 6 steps, all on a single page:
 *   1. Type               (Message template vs. Interactive flow)
 *   2. Send-from number
 *   3. Content            (template picker or flow picker)
 *   4. Flow entry message (if type=flow)
 *   5. Audience           (CSV/XLSX upload OR tag segment)
 *   6. Template variables (derived from selected template + CSV headers)
 *
 * All validation, CSV/XLSX parsing, tag-popover logic, and server-action
 * wiring is preserved — only the visuals are re-rendered in Clay.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import type { WithId } from 'mongodb';
import {
  LuCircleAlert,
  LuCheck,
  LuChevronsUpDown,
  LuDownload,
  LuSend,
  LuUpload,
  LuLoader,
  LuFileText,
  LuTag,
} from 'react-icons/lu';

import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import { useToast } from '@/hooks/use-toast';
import type { Template, Tag, MetaFlow } from '@/lib/definitions';
import { TemplateInputRenderer } from './template-input-renderer';
import { useProject } from '@/context/project-context';
import { cn } from '@/lib/utils';

import { ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/* ══════════════════════════════════════════════════════════════════
 *  Helpers (unchanged from original — CSV/XLSX parsing + validation)
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
    <ClayButton
      type="submit"
      variant="rose"
      size="lg"
      disabled={pending || disabled}
      leading={
        pending ? (
          <LuLoader className="h-4 w-4 animate-spin" />
        ) : (
          <LuSend className="h-4 w-4" strokeWidth={2} />
        )
      }
    >
      {pending ? 'Queueing broadcast…' : 'Start broadcast'}
    </ClayButton>
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
      {selectedTagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      {/* ── Steps 1 + 2: Type + Phone number ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={1} label="Broadcast type" />
          <RadioGroup
            value={broadcastType}
            onValueChange={(v) => setBroadcastType(v as 'template' | 'flow')}
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
            name="phoneNumberId"
            value={selectedPhoneNumber}
            onValueChange={setSelectedPhoneNumber}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a number…" />
            </SelectTrigger>
            <SelectContent>
              {(activeProject?.phoneNumbers || []).map((phone) => (
                <SelectItem key={phone.id} value={phone.id}>
                  {phone.display_phone_number} · {phone.verified_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            name="templateId"
            value={selectedTemplate?._id.toString() || ''}
            onValueChange={handleTemplateChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an approved template…" />
            </SelectTrigger>
            <SelectContent>
              {approvedTemplates.length > 0 ? (
                approvedTemplates.map((template) => (
                  <SelectItem
                    key={template._id.toString()}
                    value={template._id.toString()}
                  >
                    {template.name}
                    <span className="ml-2 text-[11px] capitalize text-clay-ink-soft">
                      {template.status
                        ? template.status.replace(/_/g, ' ').toLowerCase()
                        : 'n/a'}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-[12px] text-clay-ink-muted">
                  No approved templates found. Sync with Meta or create a new
                  one.
                </div>
              )}
            </SelectContent>
          </Select>
        ) : (
          <Select
            name="flowId"
            value={selectedFlow?._id.toString() || ''}
            onValueChange={handleFlowChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a flow…" />
            </SelectTrigger>
            <SelectContent>
              {metaFlows.length > 0 ? (
                metaFlows.map((flow) => (
                  <SelectItem
                    key={flow._id.toString()}
                    value={flow._id.toString()}
                  >
                    {flow.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-[12px] text-clay-ink-muted">
                  No flows found. Sync with Meta or create a new one.
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Flow-only fields ── */}
      {broadcastType === 'flow' && (
        <div className="grid gap-4 rounded-[14px] border border-clay-border bg-clay-surface-2 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-[11.5px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              Flow entry message
            </Label>
            <p className="mt-0.5 text-[11.5px] text-clay-ink-soft">
              Define how the flow entry message looks to the user.
            </p>
          </div>
          <Field
            label="Header"
            optional
            htmlFor="flowHeader"
          >
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

      {/* ── Step 4: Audience ── */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={4} label="Audience" />
          <input type="hidden" name="audienceType" value={audienceType} />
          <RadioGroup
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
          </RadioGroup>
        </div>

        {audienceType === 'file' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11.5px] font-semibold text-clay-ink-muted">
                Contact file <span className="ml-1 text-clay-red">*</span>
              </Label>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-clay-ink-muted transition-colors hover:text-clay-rose"
              >
                <LuDownload className="h-3 w-3" strokeWidth={2} />
                Sample CSV
              </button>
            </div>
            <label
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-6 text-center transition-colors',
                selectedFile
                  ? 'border-clay-rose bg-clay-rose-soft/60'
                  : 'border-clay-border-strong bg-clay-surface-2 hover:bg-clay-bg-2',
              )}
            >
              <LuUpload
                className={cn(
                  'h-5 w-5 transition-colors',
                  selectedFile ? 'text-clay-rose-ink' : 'text-clay-ink-soft',
                )}
                strokeWidth={1.75}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-clay-ink">
                  {selectedFile?.name || 'Click to choose a file'}
                </span>
                <span className="text-[11px] text-clay-ink-soft">
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
            <div className="mt-0.5 text-[11px] text-clay-ink-soft">
              For variables, use column names that match your template (e.g.{' '}
              <code className="rounded-[3px] bg-clay-bg-2 px-1 font-mono text-[10px] text-clay-rose-ink">
                variable1
              </code>
              ).
            </div>

            {isValidating ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-clay-blue">
                <LuLoader className="h-3 w-3 animate-spin" />
                Validating file…
              </p>
            ) : null}

            {validationErrors.length > 0 && (
              <div className="mt-2 rounded-[12px] border border-clay-red/40 bg-clay-red-soft p-3">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-clay-red">
                  <LuCircleAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  File error
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px] text-clay-red/90">
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
            <Label className="text-[11.5px] font-semibold text-clay-ink-muted">
              Contact tags
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  className={cn(
                    'inline-flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] font-medium transition-colors hover:border-clay-border-strong',
                    selectedTagIds.length === 0 && 'text-clay-ink-soft',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <LuTag className="h-3.5 w-3.5" strokeWidth={2} />
                    {selectedTagIds.length > 0
                      ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'} selected`
                      : 'Select tags…'}
                  </span>
                  <LuChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
                              className={cn(
                                'mr-2 flex h-4 w-4 items-center justify-center rounded-[4px] border',
                                isSelected
                                  ? 'border-clay-rose bg-clay-rose text-white'
                                  : 'border-clay-border',
                              )}
                            >
                              {isSelected ? (
                                <LuCheck
                                  className="h-3 w-3"
                                  strokeWidth={3}
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
            <div className="mt-0.5 text-[11px] text-clay-ink-soft">
              Send this broadcast to every contact matching one or more of
              these tags.
            </div>
          </div>
        )}
      </div>

      {/* ── Step 5: Template variables ── */}
      {broadcastType === 'template' && selectedTemplate && (
        <div className="flex flex-col gap-3">
          <StepLabel step={5} label="Template variables" />
          <div className="rounded-[14px] border border-clay-border bg-clay-surface-2 p-5">
            <TemplateInputRenderer
              template={selectedTemplate}
              variableOptions={variableOptions}
            />
          </div>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex flex-col items-stretch gap-3 border-t border-clay-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11.5px] text-clay-ink-muted">
          <LuFileText className="h-3.5 w-3.5" strokeWidth={2} />
          {selectedFile ? (
            <span>
              Ready:{' '}
              <span className="font-medium text-clay-ink">
                {selectedFile.name}
              </span>{' '}
              {validationErrors.length > 0 ? (
                <span className="text-clay-red">
                  · {validationErrors.length} issue
                  {validationErrors.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="text-clay-green">· validated</span>
              )}
            </span>
          ) : audienceType === 'tags' && selectedTagIds.length > 0 ? (
            <span>
              Audience:{' '}
              <span className="font-medium text-clay-ink">
                {selectedTagIds.length} tag
                {selectedTagIds.length === 1 ? '' : 's'}
              </span>
            </span>
          ) : (
            <span>
              Complete the steps above to queue a broadcast.
            </span>
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
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-clay-ink">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-clay-rose-soft text-[10px] font-semibold tabular-nums text-clay-rose-ink">
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
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-[12px] border px-3 py-2.5 transition-colors',
        active
          ? 'border-clay-rose bg-clay-rose-soft/50'
          : 'border-clay-border bg-clay-surface hover:bg-clay-surface-2',
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium leading-tight text-clay-ink">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-tight text-clay-ink-muted">
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
      <Label
        htmlFor={htmlFor}
        className="text-[11.5px] font-semibold text-clay-ink-muted"
      >
        {label}
        {required ? <span className="ml-1 text-clay-red">*</span> : null}
        {optional ? (
          <span className="ml-1 font-normal text-clay-ink-fade">
            (optional)
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}
