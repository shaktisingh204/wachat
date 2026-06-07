'use client';

import {
  Button,
  Field,
  Input,
  Label,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Alert,
  Tag,
  cn,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { WithId } from 'mongodb';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Download,
  Send,
  Loader2,
  Upload,
  FileText,
  TagIcon,
} from 'lucide-react';

import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import { useToast } from '@/hooks/use-toast';
import type { Template, Tag as TagType, MetaFlow } from '@/lib/definitions';
import { TemplateInputRenderer } from './template-input-renderer';
import { useProject } from '@/context/project-context';

/**
 * BroadcastForm - the WhatsApp broadcast composer, rebuilt on 20ui.
 *
 * 6 steps, all on a single page:
 *   1. Type               (Message template vs. Interactive flow)
 *   2. Send-from number
 *   3. Content            (template picker or flow picker)
 *   4. Flow entry message (if type=flow)
 *   5. Audience           (CSV/XLSX from SabFiles OR tag segment)
 *   6. Template variables (derived from selected template + CSV headers)
 *
 * All validation, CSV/XLSX parsing, tag-popover logic, and server-action
 * wiring is preserved. The contact file is sourced from SabFiles and
 * injected into the submitted FormData as `csvFile`.
 */

import * as React from 'react';

/* ==================================================================
 *  Helpers (unchanged from original: CSV/XLSX parsing + validation)
 * ================================================================== */

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

/* ==================================================================
 *  Submit button
 * ================================================================== */

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="gradient"
      size="lg"
      disabled={pending || disabled}
      loading={pending}
      iconLeft={pending ? undefined : Send}
    >
      {pending ? 'Queueing broadcast...' : 'Start broadcast'}
    </Button>
  );
}

/* ==================================================================
 *  Main component
 * ================================================================== */

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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const [variableOptions, setVariableOptions] = useState<string[]>([]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Queued', description: state.message, tone: 'success' });
      formRef.current?.reset();
      setSelectedFile(null);
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

  /**
   * Inject the SabFiles-sourced contact file into the submitted FormData
   * so the server action keeps reading it as `csvFile`.
   */
  const submitAction = (formData: FormData) => {
    if (selectedFile) {
      formData.set('csvFile', selectedFile, selectedFile.name);
    }
    formAction(formData);
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
    toast({ title: 'Sample file downloading...' });
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
    <form ref={formRef} action={submitAction} className="flex flex-col gap-7">
      <input
        type="hidden"
        name="projectId"
        value={activeProject?._id?.toString()}
      />
      <input type="hidden" name="broadcastType" value={broadcastType} />
      <input type="hidden" name="createContacts" value={createContacts ? 'true' : 'false'} />
      {selectedTagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      {/* Steps 1 + 2: Type + Phone number */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={1} label="Broadcast type" />
          <RadioGroup
            value={broadcastType}
            onValueChange={(v) => setBroadcastType(v as 'template' | 'flow')}
            orientation="horizontal"
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
            <SelectTrigger aria-label="Send-from number">
              <SelectValue placeholder="Choose a number..." />
            </SelectTrigger>
            <SelectContent>
              {(activeProject?.phoneNumbers || []).map((phone) => (
                <SelectItem key={phone.id} value={phone.id}>
                  {phone.display_phone_number} - {phone.verified_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Step 3: Content selection */}
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
            <SelectTrigger aria-label="Template">
              <SelectValue placeholder="Choose an approved template..." />
            </SelectTrigger>
            <SelectContent>
              {approvedTemplates.length > 0 ? (
                approvedTemplates.map((template) => (
                  <SelectItem
                    key={template._id.toString()}
                    value={template._id.toString()}
                  >
                    {template.name}
                    <span className="ml-2 text-[11px] capitalize text-[var(--st-text-secondary)]">
                      {template.status
                        ? template.status.replace(/_/g, ' ').toLowerCase()
                        : 'n/a'}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
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
            <SelectTrigger aria-label="Interactive flow">
              <SelectValue placeholder="Choose a flow..." />
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
                <div className="px-2 py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
                  No flows found. Sync with Meta or create a new one.
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Flow-only fields */}
      {broadcastType === 'flow' && (
        <div className="grid gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Flow entry message
            </Label>
            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
              Define how the flow entry message looks to the user.
            </p>
          </div>
          <Field label="Header" help="Optional">
            <Input
              name="flowHeader"
              id="flowHeader"
              placeholder="Start your application"
            />
          </Field>
          <Field label="Body text" required>
            <Input
              name="flowBody"
              id="flowBody"
              placeholder="Click below to begin..."
              required
            />
          </Field>
          <Field label="Footer" help="Optional">
            <Input
              name="flowFooter"
              id="flowFooter"
              placeholder="Wachat"
            />
          </Field>
          <Field label="CTA button" required>
            <Input
              name="flowCta"
              id="flowCta"
              placeholder="Open App"
              required
            />
          </Field>
        </div>
      )}

      {/* Step 4: Audience */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StepLabel step={4} label="Audience" />
          <input type="hidden" name="audienceType" value={audienceType} />
          <RadioGroup
            value={audienceType}
            onValueChange={(val) => setAudienceType(val as 'file' | 'tags')}
            orientation="horizontal"
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
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Contact file <span className="ml-1 text-[var(--st-text)]">*</span>
              </Label>
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
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-[var(--st-radius)] border-2 border-dashed px-4 py-6 text-center',
                selectedFile
                  ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                  : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)]',
              )}
            >
              <Upload
                className={cn(
                  'h-5 w-5',
                  selectedFile
                    ? 'text-[var(--st-text)]'
                    : 'text-[var(--st-text-secondary)]',
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-[var(--st-text)]">
                  {selectedFile?.name || 'Choose a contact file'}
                </span>
                <span className="text-[11px] text-[var(--st-text-secondary)]">
                  {selectedFile ? 'Pick again to replace' : 'CSV or XLSX from SabFiles'}
                </span>
              </div>
              <SabFileToFileButton
                accept="all"
                variant="outline"
                onPickFile={(file) => setSelectedFile(file)}
                onError={(err) =>
                  toast({ title: 'Could not load file', description: err.message, tone: 'danger' })
                }
              >
                {selectedFile ? 'Replace file' : 'Choose from SabFiles'}
              </SabFileToFileButton>
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
              For variables, use column names that match your template (e.g.{' '}
              <code className="rounded-[3px] bg-[var(--st-bg-secondary)] px-1 font-mono text-[10px] text-[var(--st-text)]">
                variable1
              </code>
              ).
            </div>

            {isValidating ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--st-text)]">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Validating file...
              </p>
            ) : null}

            {validationErrors.length > 0 && (
              <Alert tone="danger" title="File error" icon={AlertCircle} className="mt-2">
                <ul className="list-disc space-y-0.5 pl-5">
                  {validationErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validationErrors.length > 5 && (
                    <li>and {validationErrors.length - 5} more issues.</li>
                  )}
                </ul>
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
              Contact tags
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  block
                  iconLeft={TagIcon}
                  iconRight={ChevronsUpDown}
                  aria-label="Select contact tags"
                  className={cn(
                    'justify-between',
                    selectedTagIds.length === 0 && 'text-[var(--st-text-secondary)]',
                  )}
                >
                  {selectedTagIds.length > 0
                    ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'} selected`
                    : 'Select tags...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search tags..." />
                  <CommandList>
                    <CommandEmpty>No tags found.</CommandEmpty>
                    <CommandGroup>
                      {(activeProject?.tags || []).map((tag: TagType) => {
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
                                  ? 'border-[var(--st-accent)] bg-[var(--st-accent)] text-white'
                                  : 'border-[var(--st-border)]',
                              )}
                              aria-hidden="true"
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3" strokeWidth={3} />
                              ) : null}
                            </span>
                            <Tag color={tag.color}>{tag.name}</Tag>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
              Send this broadcast to every contact matching one or more of
              these tags.
            </div>
          </div>
        )}
      </div>

      {/* Step 5: Template variables */}
      {broadcastType === 'template' && selectedTemplate && (
        <div className="flex flex-col gap-3">
          <StepLabel step={5} label="Template variables" />
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-5">
            <TemplateInputRenderer
              template={selectedTemplate}
              variableOptions={variableOptions}
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-5 py-3">
        <Checkbox
          checked={createContacts}
          onChange={(e) => setCreateContacts(e.target.checked)}
          label={
            <span className="text-[12px] font-medium text-[var(--st-text)]">
              Create contacts in CRM
            </span>
          }
        />
        <span className="text-[10px] text-[var(--st-text-secondary)]">
          {createContacts
            ? 'New contacts will be added for each recipient not already in your CRM.'
            : 'Off. Only existing contacts will be updated. No new contacts created.'}
        </span>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-stretch gap-3 border-t border-[var(--st-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
          <FileText className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {selectedFile ? (
            <span>
              Ready:{' '}
              <span className="font-medium text-[var(--st-text)]">
                {selectedFile.name}
              </span>{' '}
              {validationErrors.length > 0 ? (
                <span className="text-[var(--st-text)]">
                  - {validationErrors.length} issue
                  {validationErrors.length === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="text-[var(--st-text)]">- validated</span>
              )}
            </span>
          ) : audienceType === 'tags' && selectedTagIds.length > 0 ? (
            <span>
              Audience:{' '}
              <span className="font-medium text-[var(--st-text)]">
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

/* ==================================================================
 *  Local UI helpers
 * ================================================================== */

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--st-text)]">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[10px] font-semibold tabular-nums text-[var(--st-text)]">
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
        'flex flex-1 cursor-pointer items-start gap-2.5 rounded-[var(--st-radius)] border px-3 py-2.5',
        active
          ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)]',
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium leading-tight text-[var(--st-text)]">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-tight text-[var(--st-text-secondary)]">
          {description}
        </span>
      </div>
    </label>
  );
}
