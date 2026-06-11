'use client';

/**
 * SabBigin — Custom fields manager (client).
 *
 * Lists existing custom fields per module (Deal / Contact / Company) and opens
 * a Modal to add a new one. The add form posts to the real
 * `saveCustomField(_prev, formData)` action via `useActionState`, so on success
 * the router refreshes and the new field appears in the list.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Tag } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
  Field,
  Input,
  Modal,
  SegmentedControl,
  SelectField,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { saveCustomField } from '@/app/actions/crm-custom-fields.actions';

export interface CustomFieldLite {
  id: string;
  entityKind: string;
  name: string;
  label: string;
  fieldType: string;
  required: boolean;
  isActive: boolean;
}

export interface FieldsManagerProps {
  /** Map of module key → fields belonging to it. */
  fieldsByModule: Record<string, CustomFieldLite[]>;
}

const MODULES = [
  { value: 'deal', label: 'Deal' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
];

const FIELD_TYPE_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'Dropdown (single)' },
  { value: 'multiselect', label: 'Dropdown (multi)' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'f_$1');
}

export function FieldsManager({ fieldsByModule }: FieldsManagerProps) {
  const router = useRouter();
  const [activeModule, setActiveModule] = React.useState('deal');
  const [open, setOpen] = React.useState(false);

  const fields = fieldsByModule[activeModule] ?? [];

  return (
    <>
      <Card padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Tag className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
            Custom fields
          </CardTitle>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => setOpen(true)}
          >
            Add field
          </Button>
        </CardHeader>
        <CardBody className="flex flex-col gap-4 pt-0">
          <SegmentedControl
            items={MODULES}
            value={activeModule}
            onChange={(v) => setActiveModule(v)}
            aria-label="Module"
          />

          {fields.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Tag}
              title={`No custom fields on ${moduleLabel(activeModule)} yet`}
              description="Add a field to capture data specific to your business."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => setOpen(true)}
                >
                  Add field
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Label</Th>
                  <Th>Internal name</Th>
                  <Th>Type</Th>
                  <Th>Required</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                {fields.map((f) => (
                  <Tr key={f.id}>
                    <Td>
                      <span className="font-medium text-[var(--st-text)]">
                        {f.label}
                      </span>
                    </Td>
                    <Td>
                      <code className="text-xs text-[var(--st-text-secondary)]">
                        {f.name}
                      </code>
                    </Td>
                    <Td>{fieldTypeLabel(f.fieldType)}</Td>
                    <Td>
                      {f.required ? (
                        <Badge tone="warning" kind="soft">Required</Badge>
                      ) : (
                        <span className="text-xs text-[var(--st-text-tertiary)]">Optional</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={f.isActive ? 'success' : 'neutral'} kind="soft">
                        {f.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <AddFieldModal
        open={open}
        onClose={() => setOpen(false)}
        defaultModule={activeModule}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function AddFieldModal({
  open,
  onClose,
  defaultModule,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultModule: string;
  onSaved: () => void;
}) {
  const [module, setModule] = React.useState(defaultModule);
  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [nameEdited, setNameEdited] = React.useState(false);
  const [fieldType, setFieldType] = React.useState('text');
  const [required, setRequired] = React.useState(false);
  const [optionsText, setOptionsText] = React.useState('');
  const [helpText, setHelpText] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Reset when (re)opened.
  React.useEffect(() => {
    if (open) {
      setModule(defaultModule);
      setLabel('');
      setName('');
      setNameEdited(false);
      setFieldType('text');
      setRequired(false);
      setOptionsText('');
      setHelpText('');
    }
  }, [open, defaultModule]);

  const needsOptions = fieldType === 'select' || fieldType === 'multiselect';

  async function handleSubmit() {
    if (!label.trim()) {
      toast.error({ title: 'Label is required' });
      return;
    }
    const internalName = (nameEdited ? name : slugify(label)).trim();
    if (!/^[a-z][a-z0-9_]*$/.test(internalName)) {
      toast.error({
        title: 'Invalid internal name',
        description:
          'Use lowercase letters, digits, and underscores, starting with a letter.',
      });
      return;
    }

    const fd = new FormData();
    fd.set('entityKind', module);
    fd.set('label', label.trim());
    fd.set('name', internalName);
    fd.set('fieldType', fieldType);
    if (helpText.trim()) fd.set('helpText', helpText.trim());
    if (required) fd.set('required', 'on');
    fd.set('isActive', 'on');
    fd.set('visibleInForm', 'on');
    fd.set('editableInForm', 'on');

    if (needsOptions) {
      const options = optionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ label: line, value: slugify(line) || line }));
      if (options.length === 0) {
        toast.error({
          title: 'Options required',
          description: 'Add at least one option, one per line.',
        });
        return;
      }
      fd.set('optionsJson', JSON.stringify(options));
    }

    setSaving(true);
    try {
      const res = await saveCustomField(undefined, fd);
      if (res.error) {
        toast.error({ title: 'Could not add field', description: res.error });
        return;
      }
      toast.success({ title: res.message ?? 'Custom field created' });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add custom field"
      description="Capture data specific to your business on this module."
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            onClick={handleSubmit}
          >
            Add field
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Module">
          <SelectField
            options={MODULES}
            value={module}
            onChange={(v) => setModule(v ?? 'deal')}
          />
        </Field>

        <Field label="Display label" help="What your team sees on the record.">
          <Input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!nameEdited) setName(slugify(e.target.value));
            }}
            placeholder="e.g. Lead source"
            autoFocus
          />
        </Field>

        <Field
          label="Internal name"
          help="Used in the API and exports. Lowercase, underscores only."
        >
          <Input
            value={nameEdited ? name : slugify(label)}
            onChange={(e) => {
              setNameEdited(true);
              setName(e.target.value);
            }}
            className="font-mono"
            placeholder="lead_source"
          />
        </Field>

        <Field label="Field type">
          <SelectField
            options={FIELD_TYPE_OPTIONS}
            value={fieldType}
            onChange={(v) => setFieldType(v ?? 'text')}
          />
        </Field>

        {needsOptions ? (
          <Field label="Options" help="One option per line.">
            <Textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              placeholder={'Website\nReferral\nEvent'}
            />
          </Field>
        ) : null}

        <Field label="Help text (optional)">
          <Input
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
            placeholder="Shown under the field"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-[var(--st-text)]">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--st-border)]"
          />
          Required field
        </label>
      </div>
    </Modal>
  );
}

function moduleLabel(key: string): string {
  return MODULES.find((m) => m.value === key)?.label ?? key;
}

function fieldTypeLabel(key: string): string {
  return FIELD_TYPE_OPTIONS.find((o) => o.value === key)?.label ?? key;
}
