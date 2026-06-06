'use client';

/**
 * SabCreator form designer.
 *
 * Left:    field palette (Text, Number, Date, Select, File).
 * Center:  the form canvas (re-orderable list — drag-drop deferred,
 *          using up/down arrows for now).
 * Right:   properties panel for the selected field + form-level submit
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

import { Badge, Button, Card, Checkbox, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, PageActions, PageDescription, PageTitle } from '@/components/sabcrm/20ui';
import { updateSabcreatorForm } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type {
  SabcreatorFormDoc,
  SabcreatorFormFieldSpec,
  SabcreatorFormSubmitAction,
} from '@/lib/rust-client/sabcreator-forms';

type FieldKind = 'text' | 'number' | 'date' | 'select' | 'file';

const PALETTE: Array<{ kind: FieldKind; label: string; icon: React.ReactNode }> = [
  { kind: 'text', label: 'Text', icon: <Type className="size-4" /> },
  { kind: 'number', label: 'Number', icon: <Hash className="size-4" /> },
  { kind: 'date', label: 'Date', icon: <CalendarDays className="size-4" /> },
  { kind: 'select', label: 'Select', icon: <List className="size-4" /> },
  { kind: 'file', label: 'File (SabFiles)', icon: <PaperclipIcon className="size-4" /> },
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
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] saveForm failed', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <div>
          <PageTitle>{form.name}</PageTitle>
          <PageDescription>
            Form designer · {app.name} ·{' '}
            <Link
              href={`/dashboard/sabcreator/${app._id}/builder`}
              className="underline"
            >
              back to builder
            </Link>
          </PageDescription>
        </div>
        <PageActions>
          <Badge variant="outline">{form.status}</Badge>
          <Button onClick={save} disabled={pending}>
            <Save className="size-4" /> {pending ? 'Saving…' : 'Save'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[200px_1fr_320px] gap-4 px-6 pb-10">
        {/* Palette */}
        <aside>
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] mb-2">
              FIELD PALETTE
            </h3>
            <div className="space-y-1">
              {PALETTE.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  onClick={() => addField(p.kind)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left hover:bg-[var(--st-bg-muted)]"
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        {/* Canvas */}
        <main>
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] mb-3">
              FORM CANVAS
            </h3>
            {fields.length === 0 ? (
              <div className="text-sm text-[var(--st-text-secondary)] py-8 text-center">
                Click a field in the palette to add it.
              </div>
            ) : (
              <ul className="space-y-2">
                {fields.map((f) => (
                  <li
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedId === f.id
                        ? 'border-primary bg-[var(--st-text)]/5'
                        : 'hover:bg-[var(--st-bg-muted)]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {f.label}{' '}
                          {f.required ? (
                            <span className="text-[var(--st-text)]">*</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                          {f.kind} · {f.tableFieldId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(f.id, -1);
                          }}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(f.id, 1);
                          }}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </main>

        {/* Properties */}
        <aside className="space-y-4">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] mb-2">
              FIELD PROPERTIES
            </h3>
            {selected ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input
                    value={selected.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Table field id</Label>
                  <Input
                    value={selected.tableFieldId}
                    onChange={(e) =>
                      updateSelected({ tableFieldId: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Help text</Label>
                  <Textarea
                    rows={2}
                    value={selected.helpText ?? ''}
                    onChange={(e) => updateSelected({ helpText: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="req"
                    checked={!!selected.required}
                    onCheckedChange={(c) => updateSelected({ required: Boolean(c) })}
                  />
                  <Label htmlFor="req">Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hidden"
                    checked={!!selected.hidden}
                    onCheckedChange={(c) => updateSelected({ hidden: Boolean(c) })}
                  />
                  <Label htmlFor="hidden">Hidden</Label>
                </div>
                <Button variant="outline" size="sm" onClick={removeSelected}>
                  <Trash2 className="size-4" /> Remove field
                </Button>
              </div>
            ) : (
              <div className="text-xs text-[var(--st-text-secondary)]">
                Select a field on the canvas to edit it.
              </div>
            )}
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] mb-2">
              SUBMIT BEHAVIOUR
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>SabTables table id</Label>
                <Input
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  placeholder="sabtables_tables _id"
                />
              </div>
              <div className="space-y-1">
                <Label>On submit</Label>
                <Select
                  value={submitAction}
                  onValueChange={(v) =>
                    setSubmitAction(v as SabcreatorFormSubmitAction)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createRecord">
                      Create record
                    </SelectItem>
                    <SelectItem value="updateRecord">
                      Update record
                    </SelectItem>
                    <SelectItem value="callWorkflow">
                      Call workflow
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {submitAction === 'callWorkflow' ? (
                <div className="space-y-1">
                  <Label>SabCreator workflow id</Label>
                  <Input
                    value={submitWorkflowId}
                    onChange={(e) => setSubmitWorkflowId(e.target.value)}
                    placeholder="sabcreator_workflows _id"
                  />
                </div>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
