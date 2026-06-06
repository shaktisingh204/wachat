'use client';

import { Button, Input, Textarea, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Label } from '@/components/sabcrm/20ui/compat';
import { Plus, Trash2, Edit, Check, AlertTriangle, Barcode, Calendar } from 'lucide-react';

/**
 * Line-items table for `<DeliveryForm>`. Extracted to its own file.
 *
 * Upgraded with a premium popup Serial & Batch Number Allocation Dialog.
 * Displays a clean summary of allocated inventory details per row.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

export interface DcLineRow {
  id: string;
  itemId?: string;
  name: string;
  hsnCode?: string;
  unit?: string;
  quantity: number;
  batch?: string;
  expiry?: string;
  serialNumbersText?: string;
}

export interface DcLineItemsTableProps {
  rows: DcLineRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<DcLineRow>) => void;
}

interface AllocationDialogProps {
  row: DcLineRow;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (batch: string, expiry: string, serialNumbersText: string) => void;
}

function SerialBatchAllocationDialog({
  row,
  isOpen,
  onOpenChange,
  onSave,
}: AllocationDialogProps) {
  const [batch, setBatch] = React.useState(row.batch ?? '');
  const [expiry, setExpiry] = React.useState(row.expiry ?? '');
  const [inputText, setInputText] = React.useState('');
  const [serials, setSerials] = React.useState<string[]>(() => {
    return (row.serialNumbersText ?? '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  });

  React.useEffect(() => {
    if (isOpen) {
      setBatch(row.batch ?? '');
      setExpiry(row.expiry ?? '');
      setSerials(
        (row.serialNumbersText ?? '')
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }, [isOpen, row]);

  const handleAddSerials = () => {
    if (!inputText.trim()) return;
    const newItems = inputText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSerials((prev) => {
      const next = [...prev];
      newItems.forEach((item) => {
        if (!next.includes(item)) next.push(item);
      });
      return next;
    });
    setInputText('');
  };

  const handleRemoveSerial = (idx: number) => {
    setSerials((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    onSave(batch.trim(), expiry, serials.join('\n'));
    onOpenChange(false);
  };

  const serialsMatch = serials.length === row.quantity;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-lg p-6 bg-[var(--st-bg)] border border-[var(--st-border)] text-[var(--st-text)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Barcode className="h-5 w-5 text-[var(--st-text)]" /> Allocate Serials & Batches
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--st-text-secondary)]">
            Specify the tracking batch number, expiration date, and physical serial codes for:
            <strong className="block mt-1 text-[var(--st-text)]">{row.name || 'Unnamed Item'}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-[var(--st-text-secondary)]">Batch Number</Label>
              <Input
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. BAT-2026-05"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[var(--st-text-secondary)]">Expiry Date</Label>
              <Input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <div className="border-t border-[var(--st-border)] pt-3">
            <Label className="text-xs font-semibold text-[var(--st-text-secondary)] flex items-center justify-between mb-1.5">
              <span>Serial Numbers</span>
              {row.quantity > 0 && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    serialsMatch
                      ? 'bg-[var(--st-text)]/10 text-[var(--st-text)] border border-[var(--st-border)]/20'
                      : 'bg-[var(--st-text)]/10 text-[var(--st-text)] border border-[var(--st-border)]/20'
                  }`}
                >
                  {serialsMatch ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {serials.length} of {row.quantity} Allocated
                </span>
              )}
            </Label>

            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type serials (one per line or comma-separated)..."
                className="text-xs flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddSerials}
                className="h-auto shrink-0 text-xs px-3"
              >
                Add
              </Button>
            </div>

            {serials.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 flex flex-wrap gap-1.5">
                {serials.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-2 py-0.5 text-[11px] text-[var(--st-text)] hover:border-[var(--st-danger)]/40 group transition-colors"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemoveSerial(idx)}
                      className="text-[var(--st-text-secondary)] group-hover:text-[var(--st-danger)] hover:font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" size="sm" onClick={handleApply} className="text-xs">
            Apply Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DcLineItemsTable({
  rows,
  onAdd,
  onRemove,
  onPatch,
}: DcLineItemsTableProps) {
  const [activeAllocRow, setActiveAllocRow] = React.useState<DcLineRow | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Line items
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--st-bg-muted)] text-left text-[var(--st-text-secondary)]">
            <tr>
              <th className="p-2.5 font-medium">Item Description</th>
              <th className="p-2.5 font-medium">HSN/SAC</th>
              <th className="w-[100px] p-2.5 text-right font-medium">Qty</th>
              <th className="w-[140px] p-2.5 font-medium">Unit</th>
              <th className="p-2.5 font-medium">Tracking & Allocation details</th>
              <th className="w-[100px] p-2.5 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const serials = (row.serialNumbersText ?? '')
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean);

              const hasBatch = !!row.batch;
              const hasExpiry = !!row.expiry;
              const hasSerials = serials.length > 0;

              return (
                <tr key={row.id} className="border-t border-[var(--st-border)] align-middle">
                  <td className="min-w-[200px] p-2">
                    <EntityFormField
                      entity="item"
                      name={`row-${row.id}-itemPicker`}
                      initialId={row.itemId ?? null}
                      placeholder="Pick item or type below…"
                      onChange={(id, hydrated) => {
                        const raw = (hydrated?.raw ?? {}) as Record<string, unknown>;
                        const nm =
                          (typeof raw.name === 'string' && raw.name) ||
                          hydrated?.chip?.primary ||
                          row.name;
                        const hsn =
                          (typeof raw.hsnSac === 'string' && raw.hsnSac) ||
                          (typeof raw.hsnCode === 'string' && raw.hsnCode) ||
                          row.hsnCode;
                        const unit =
                          (typeof raw.unit === 'string' && raw.unit) || row.unit;
                        onPatch(row.id, {
                          itemId: id ?? undefined,
                          name: nm,
                          hsnCode: hsn,
                          unit,
                        });
                      }}
                    />
                    <Input
                      value={row.name}
                      onChange={(e) => onPatch(row.id, { name: e.target.value })}
                      placeholder="Item description"
                      className="mt-1 h-8 text-[12.5px]"
                      maxLength={200}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.hsnCode ?? ''}
                      onChange={(e) => onPatch(row.id, { hsnCode: e.target.value })}
                      placeholder="e.g. 998314"
                      className="h-9 text-[12.5px]"
                      maxLength={20}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={row.quantity}
                      onChange={(e) =>
                        onPatch(row.id, { quantity: Number(e.target.value) || 0 })
                      }
                      className="h-9 text-right text-[12.5px] tabular-nums"
                    />
                  </td>
                  <td className="min-w-[120px] p-2">
                    <EntityFormField
                      entity="unit"
                      name={`row-${row.id}-unitPicker`}
                      initialId={row.unit ?? null}
                      placeholder="e.g. PCS"
                      onChange={(id) => onPatch(row.id, { unit: id ?? undefined })}
                    />
                  </td>
                  <td className="p-2 min-w-[220px]">
                    <div className="flex flex-col gap-1.5">
                      {(!hasBatch && !hasExpiry && !hasSerials) ? (
                        <span className="text-[12px] text-[var(--st-text-secondary)] italic">
                          No batches or serial numbers assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {hasBatch && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text)]">
                              <Barcode className="h-3 w-3 text-[var(--st-text-secondary)]" /> Batch: {row.batch}
                            </span>
                          )}
                          {hasExpiry && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text)]">
                              <Calendar className="h-3 w-3 text-[var(--st-text-secondary)]" /> Exp: {row.expiry}
                            </span>
                          )}
                          {hasSerials && (
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                              serials.length === row.quantity
                                ? 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]/20'
                                : 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]/20'
                            }`}>
                              {serials.length} serials
                            </span>
                          )}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setActiveAllocRow(row)}
                        className="text-xs h-auto p-0 justify-start text-[var(--st-text)] hover:underline"
                      >
                        <Edit className="h-3 w-3 mr-1" /> Allocate & Manage
                      </Button>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(row.id)}
                      disabled={rows.length === 1}
                      className="text-[var(--st-danger)] mx-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeAllocRow && (
        <SerialBatchAllocationDialog
          row={activeAllocRow}
          isOpen={activeAllocRow !== null}
          onOpenChange={(open) => {
            if (!open) setActiveAllocRow(null);
          }}
          onSave={(b, e, s) => {
            onPatch(activeAllocRow.id, {
              batch: b,
              expiry: e,
              serialNumbersText: s,
            });
            setActiveAllocRow(null);
          }}
        />
      )}
    </div>
  );
}
