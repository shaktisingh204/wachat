'use client';

import { Card, Input, Label } from '@/components/sabcrm/20ui';
import { Paperclip, Trash2 } from 'lucide-react';

/**
 * <QuotationFormExtras> — attachments, signature, template, and
 * summary sections of the `<QuotationForm>`. Extracted to keep the
 * parent file under the 600-line cap. The parent owns state for
 * attachments, signature, and summary numbers; this component is
 * pure presentation.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

interface SummaryNumbers {
  subTotal: number;
  taxTotal: number;
  total: number;
}

interface QuotationFormExtrasProps {
  totals: SummaryNumbers;
  discountOverall: number;
  shippingCharge: number;
  adjustment: number;
  roundOff: number;
  attachments: string[];
  signatureImage: string;
  fmtMoney: (n: number) => string;
  onDiscountChange: (next: number) => void;
  onShippingChange: (next: number) => void;
  onAdjustmentChange: (next: number) => void;
  onRoundOffChange: (next: number) => void;
  onAddAttachment: (url: string) => void;
  onRemoveAttachment: (url: string) => void;
  onSetSignature: (url: string) => void;
  onTemplateChange: () => void;
}

/* ─── Section: Summary ─────────────────────────────────────────── */

export function QuotationSummarySection({
  totals,
  discountOverall,
  shippingCharge,
  adjustment,
  roundOff,
  fmtMoney,
  onDiscountChange,
  onShippingChange,
  onAdjustmentChange,
  onRoundOffChange,
}: Omit<
  QuotationFormExtrasProps,
  | 'attachments'
  | 'signatureImage'
  | 'onAddAttachment'
  | 'onRemoveAttachment'
  | 'onSetSignature'
  | 'onTemplateChange'
>) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Summary</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-[13px]">
          <SummaryRow label="Subtotal" value={fmtMoney(totals.subTotal)} />
          <SummaryRow label="Tax" value={fmtMoney(totals.taxTotal)} />
          <SummaryRow label="Total" value={fmtMoney(totals.total)} emphasis />
        </div>
        <div className="space-y-2">
          <NumberRow label="Discount" value={discountOverall} onChange={onDiscountChange} />
          <NumberRow label="Shipping" value={shippingCharge} onChange={onShippingChange} />
          <NumberRow label="Adjustment" value={adjustment} onChange={onAdjustmentChange} />
          <NumberRow label="Round-off" value={roundOff} onChange={onRoundOffChange} />
        </div>
      </div>
    </Card>
  );
}

/* ─── Section: Attachments + Signature ─────────────────────────── */

export function QuotationAttachmentsSection({
  attachments,
  signatureImage,
  onAddAttachment,
  onRemoveAttachment,
  onSetSignature,
}: Pick<
  QuotationFormExtrasProps,
  | 'attachments'
  | 'signatureImage'
  | 'onAddAttachment'
  | 'onRemoveAttachment'
  | 'onSetSignature'
>) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
          Attachments &amp; signature
        </h2>
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
          All files come from SabFiles. URL pastes are intentionally disabled.
        </p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Attachments</Label>
          <div className="flex flex-wrap items-center gap-2">
            {attachments.map((url) => (
              <span
                key={url}
                className="inline-flex items-center gap-1.5 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 text-[12px] text-[var(--st-text)]"
              >
                <Paperclip className="h-3 w-3 text-[var(--st-text-secondary)]" />
                <span className="max-w-[16ch] truncate">{url.split('/').pop()}</span>
                <button
                  type="button"
                  className="text-[var(--st-danger)] hover:opacity-80"
                  aria-label="Remove attachment"
                  onClick={() => onRemoveAttachment(url)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            <SabFilePickerButton
              onPick={(pick) => onAddAttachment(pick.url)}
              variant="outline"
            >
              Add file
            </SabFilePickerButton>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Signature image</Label>
          <div className="flex flex-wrap items-center gap-2">
            {signatureImage ? (
              <span className="inline-flex items-center gap-1.5 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 text-[12px] text-[var(--st-text)]">
                <span className="max-w-[16ch] truncate">
                  {signatureImage.split('/').pop()}
                </span>
                <button
                  type="button"
                  className="text-[var(--st-danger)] hover:opacity-80"
                  aria-label="Remove signature"
                  onClick={() => onSetSignature('')}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            <SabFilePickerButton
              accept="image"
              onPick={(pick) => onSetSignature(pick.url)}
              variant="outline"
            >
              {signatureImage ? 'Replace signature' : 'Pick signature'}
            </SabFilePickerButton>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─── Section: Template ────────────────────────────────────────── */

export function QuotationTemplateSection({
  onTemplateChange,
}: Pick<QuotationFormExtrasProps, 'onTemplateChange'>) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Template</h2>
      </div>
      <div className="space-y-1.5">
        <Label>Template</Label>
        <EntityFormField
          entity="quotation"
          name="templateId"
          initialId={null}
          placeholder="Pick a quotation template (optional)"
          onChange={onTemplateChange}
        />
      </div>
    </Card>
  );
}

/* ─── Tiny presentational helpers ──────────────────────────────── */

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? 'flex justify-between border-t border-[var(--st-border)] pt-2 text-[var(--st-text)]'
          : 'flex justify-between text-[var(--st-text-secondary)]'
      }
    >
      <span>{label}</span>
      <span className={emphasis ? 'font-medium tabular-nums' : 'tabular-nums'}>
        {value}
      </span>
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[12.5px] text-[var(--st-text-secondary)]">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 w-32 text-right text-[12.5px]"
      />
    </div>
  );
}
