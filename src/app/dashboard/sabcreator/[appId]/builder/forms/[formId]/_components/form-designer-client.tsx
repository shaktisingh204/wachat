'use client';

/**
 * SabCreator form designer.
 *
 * Left:    field palette (Text, Number, Date, Select, File).
 * Center:  the form canvas (re-orderable list). Drag-drop is deferred, so
 *          up/down arrows handle ordering for now.
 * Right:   properties panel for the selected field plus form-level submit
 *          settings.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Hash,
  List,
  PaperclipIcon,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { updateSabcreatorForm } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type {
  SabcreatorFormDoc,
  SabcreatorFormFieldSpec,
  SabcreatorFormSubmitAction,
} from '@/lib/rust-client/sabcreator-forms';

type FieldKind = 'text' | 'number' | 'date' | 'select' | 'file';

const PALETTE: Array<{ kind: FieldKind; label: string; icon: LucideIcon }> = [
  { kind: 'text', label: 'Text', icon: Type },
  { kind: 'number', label: 'Number', icon: Hash },
  { kind: 'date', label: 'Date', icon: CalendarDays },
  { kind: 'select', label: 'Select', icon: List },
  { kind: 'file', label: 'File (SabFiles)', icon: PaperclipIcon },
];

interface InternalField extends SabcreatorFormFieldSpec {
  id: string;
  kind: FieldKind;
}

function toInternal(fields: unknown): InternalField[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f, i) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return {
      id: String(o.tableFieldId ?? `f-${i}-${Math.random().toString(36).slice(2, 8)}`),
      kind: (o.kind as FieldKind) ?? 'text',
      tableFieldId: String(o.tableFieldId ?? `f-${i}`),
      label: String(o.label ?? `Field ${i + 1}`),
      helpText: o.helpText as string | undefined,
      required: Boolean(o.required),
      hidden: Boolean(o.hidden),
      defaultValue: o.defaultValue,
      validations: o.validations as Record<string, unknown> | undefined,
      conditional: o.conditional as Record<string, unknown> | undefined,
    };
  });
}

interface Props {
  app: SabcreatorAppDoc;
  form: SabcreatorFormDoc;
}

export function FormDesignerClient({ app, form }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [fields, setFields] = useState<InternalField[]>(() => toInternal(form.fieldsJson));
  const [selectedId, setSelectedId] = useState<string | null>(
    fields[0]?.id ?? null,
  );
  const [submitAction, setSubmitAction] = useState<SabcreatorFormSubmitAction>(
    form.submitAction,
  );
  const [submitWorkflowId, setSubmitWorkflowId] = useState(
    form.submitWorkflowId ?? '',
  );
  const [tableId, setTableId] = useState(form.sabtablesTableId ?? '');
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const addField = (kind: FieldKind) => {
    const id = `f-${Date.now().toString(36)}`;
    const next: InternalField = {
      id,
      kind,
      tableFieldId: id,
      label: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} field`,
      required: false,
    };
    setFields((p) => [...p, next]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<InternalField>) => {
    if (!selected) return;
    setFields((p) =>
      p.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    setFields((p) => p.filter((f) => f.id !== selected.id));
    setSelectedId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    setFields((p) => {
      const idx = p.findIndex((f) => f.id === id);
      if (idx < 0) return p;
      const target = idx + dir;
      if (target < 0 || target >= p.length) return p;
      const next = p.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateSabcreatorForm(form._id, app._id, {
          fieldsJson: fields,
          submitAction,
          submitWorkflowId:
            submitAction === 'callWorkflow' && submitWorkflowId.trim()
              ? submitWorkflowId.trim()
              : undefined,
          sabtablesTableId: tableId.trim() || undefined,
        });
        toast.success('Form saved');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] saveForm failed', err);
        toast.error('Could not save the form');
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{form.name}</PageTitle>
          <PageDescription>
            Form designer, {app.name},{' '}
            <Link
              href={`/dashboard/sabcreator/${app._id}/builder`}
              className="underline"
            >
              back to builder
            </Link>
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Badge kind="outline">{form.status}</Badge>
          <Button variant="primary" onClick={save} loading={pending} iconLeft={Save}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[200px_1fr_320px] gap-4 px-6 pb-10">
        {/* Palette */}
        <aside>
          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Field palette
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-1">
              {PALETTE.map((p) => (
                <Button
                  key={p.kind}
                  variant="ghost"
                  block
                  iconLeft={p.icon}
                  onClick={() => addField(p.kind)}
                  className="justify-start"
                >
                  {p.label}
                </Button>
              ))}
            </CardBody>
          </Card>
        </aside>

        {/* Canvas */}
        <main>
          <Card padding="md">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Form canvas
              </CardTitle>
            </CardHeader>
            <CardBody>
              {fields.length === 0 ? (
                <EmptyState
                  icon={Type}
                  title="No fields yet"
                  description="Click a field in the palette to add it."
                />
              ) : (
                <ul className="space-y-2">
                  {fields.map((f) => (
                    <li
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className={`p-3 border rounded-[var(--st-radius)] cursor-pointer transition-colors ${
                        selectedId === f.id
                          ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                          : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate text-[var(--st-text)]">
                            {f.label}{' '}
                            {f.required ? (
                              <span className="text-[var(--st-danger)]">*</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[var(--st-text-secondary)]">
                            {f.kind} - {f.tableFieldId}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <IconButton
                            label="Move field up"
                            icon={ArrowUp}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              move(f.id, -1);
                            }}
                          />
                          <IconButton
                            label="Move field down"
                            icon={ArrowDown}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              move(f.id, 1);
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </main>

        {/* Properties */}
        <aside className="space-y-4">
          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Field properties
              </CardTitle>
            </CardHeader>
            <CardBody>
              {selected ? (
                <div className="space-y-3">
                  <Field label="Label">
                    <Input
                      value={selected.label}
                      onChange={(e) => updateSelected({ label: e.target.value })}
                    />
                  </Field>
                  <Field label="Table field id">
                    <Input
                      value={selected.tableFieldId}
                      onChange={(e) =>
                        updateSelected({ tableFieldId: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Help text">
                    <Textarea
                      rows={2}
                      value={selected.helpText ?? ''}
                      onChange={(e) => updateSelected({ helpText: e.target.value })}
                    />
                  </Field>
                  <Checkbox
                    label="Required"
                    checked={!!selected.required}
                    onChange={(e) => updateSelected({ required: e.target.checked })}
                  />
                  <Checkbox
                    label="Hidden"
                    checked={!!selected.hidden}
                    onChange={(e) => updateSelected({ hidden: e.target.checked })}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Trash2}
                    onClick={removeSelected}
                  >
                    Remove field
                  </Button>
                </div>
              ) : (
                <EmptyState
                  icon={List}
                  size="sm"
                  title="No field selected"
                  description="Select a field on the canvas to edit it."
                />
              )}
            </CardBody>
          </Card>

          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Submit behaviour
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="SabTables table id">
                <Input
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  placeholder="sabtables_tables _id"
                />
              </Field>
              <Field label="On submit">
                <Select
                  value={submitAction}
                  onValueChange={(v) =>
                    setSubmitAction(v as SabcreatorFormSubmitAction)
                  }
                >
                  <SelectTrigger aria-label="On submit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createRecord">Create record</SelectItem>
                    <SelectItem value="updateRecord">Update record</SelectItem>
                    <SelectItem value="callWorkflow">Call workflow</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {submitAction === 'callWorkflow' ? (
                <Field label="SabCreator workflow id">
                  <Input
                    value={submitWorkflowId}
                    onChange={(e) => setSubmitWorkflowId(e.target.value)}
                    placeholder="sabcreator_workflows _id"
                  />
                </Field>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
