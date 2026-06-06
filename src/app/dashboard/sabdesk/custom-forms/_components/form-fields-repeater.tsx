"use client";

import { Button, Input, Label, Switch, Textarea } from "@/components/zoruui";
import { GripVertical, Plus, Trash2 } from "lucide-react";

/**
 * <FormFieldsRepeater /> — structured add/remove rows for ticket
 * custom-form field definitions.
 *
 * Per the SabNode project rule, we do NOT take a JSON paste here. Each
 * row exposes proper inputs for `name`, `label`, `type`, `required`,
 * `placeholder`, and (for select/radio/checkbox) `options`. Each input
 * is named `fields[i][key]` so the server action can read the rows
 * out of FormData in order.
 */

import * as React from "react";

import { EnumFormField } from "@/components/crm/enum-form-field";

import type { CrmFormFieldDef } from "@/lib/rust-client/crm-forms";

const OPTIONS_TYPES = new Set(["select", "radio", "checkbox"]);

interface RowState extends CrmFormFieldDef {
  /** Stable key for React reconciliation across reorders. */
  __key: string;
}

function nextKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toRows(initial: CrmFormFieldDef[] | undefined): RowState[] {
  if (!initial || initial.length === 0) return [];
  return initial.map((f) => ({ ...f, __key: nextKey() }));
}

function getDuplicateNames(rows: RowState[]): Set<string> {
  const names = rows.map((r) => r.name.trim());
  return new Set(names.filter((n, idx) => n && names.indexOf(n) !== idx));
}

export interface FormFieldsRepeaterProps {
  initialFields?: CrmFormFieldDef[];
}

export function FormFieldsRepeater({ initialFields }: FormFieldsRepeaterProps) {
  const [rows, setRows] = React.useState<RowState[]>(() =>
    toRows(initialFields),
  );

  const addRow = () => {
    setRows((r) => [
      ...r,
      {
        __key: nextKey(),
        name: "",
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((r) => r.filter((row) => row.__key !== key));
  };

  const moveRow = (key: string, dir: -1 | 1) => {
    setRows((r) => {
      const idx = r.findIndex((row) => row.__key === key);
      if (idx === -1) return r;
      const next = idx + dir;
      if (next < 0 || next >= r.length) return r;
      const copy = r.slice();
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((r) =>
      r.map((row) => (row.__key === key ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Form fields</Label>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Add, reorder, and remove the inputs that ticket creators will see.
            Order here is the order on the rendered form.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add field
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-8 text-center text-[12.5px] text-[var(--st-text-secondary)]">
          No fields yet. Click <strong>Add field</strong> to create the first
          one.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const needsOptions = OPTIONS_TYPES.has(row.type ?? "text");
            const prefix = `fields[${idx}]`;
            const duplicateNames = getDuplicateNames(rows);
            const isDuplicate =
              row.name.trim() && duplicateNames.has(row.name.trim());
            return (
              <div
                key={row.__key}
                className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                    <GripVertical className="h-4 w-4" />
                    Field #{idx + 1}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveRow(row.__key, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveRow(row.__key, 1)}
                      disabled={idx === rows.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.__key)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${prefix}-name`}>Name *</Label>
                    <Input
                      id={`${prefix}-name`}
                      name={`${prefix}[name]`}
                      required
                      pattern="^[a-zA-Z0-9_-]+$"
                      title="Only alphanumeric characters, underscores, and hyphens are allowed."
                      placeholder="e.g. order_id"
                      value={row.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        e.target.setCustomValidity(
                          !val.match(/^[a-zA-Z0-9_-]+$/)
                            ? "Only alphanumeric characters, underscores, and hyphens are allowed."
                            : duplicateNames.has(val.trim()) &&
                                rows.filter((r) => r.name.trim() === val.trim())
                                  .length > 1
                              ? "Field name must be unique."
                              : "",
                        );
                        updateRow(row.__key, { name: val });
                      }}
                      className="font-mono"
                    />
                    {isDuplicate ? (
                      <p className="text-xs text-[var(--st-text)]">
                        This field name is already in use.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${prefix}-label`}>Label</Label>
                    <Input
                      id={`${prefix}-label`}
                      name={`${prefix}[label]`}
                      placeholder="e.g. Order ID"
                      value={row.label ?? ""}
                      onChange={(e) =>
                        updateRow(row.__key, { label: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <EnumFormField
                      enumName="formFieldType"
                      name={`${prefix}[type]`}
                      initialId={row.type ?? "text"}
                      placeholder="Type"
                      allowInlineCreate={false}
                      onChange={(v) =>
                        updateRow(row.__key, { type: v ?? "text" })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${prefix}-placeholder`}>Placeholder</Label>
                    <Input
                      id={`${prefix}-placeholder`}
                      name={`${prefix}[placeholder]`}
                      placeholder="Optional hint shown inside the input"
                      value={row.placeholder ?? ""}
                      onChange={(e) =>
                        updateRow(row.__key, { placeholder: e.target.value })
                      }
                    />
                  </div>
                  {needsOptions ? (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`${prefix}-options`}>Options</Label>
                      <Textarea
                        id={`${prefix}-options`}
                        name={`${prefix}[options]`}
                        rows={3}
                        placeholder="One per line — or comma-separated"
                        value={(row.options ?? []).join("\n")}
                        onChange={(e) =>
                          updateRow(row.__key, {
                            options: e.target.value
                              .split(/\n|,/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2 sm:col-span-2">
                    <div className="flex flex-col">
                      <Label htmlFor={`${prefix}-required`}>Required</Label>
                      <span className="text-xs text-[var(--st-text-secondary)]">
                        Must be filled before the form can be submitted.
                      </span>
                    </div>
                    <Switch
                      id={`${prefix}-required`}
                      checked={!!row.required}
                      onCheckedChange={(v) =>
                        updateRow(row.__key, { required: !!v })
                      }
                    />
                    <input
                      type="hidden"
                      name={`${prefix}[required]`}
                      value={row.required ? "true" : "false"}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
