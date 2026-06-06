'use client';

import { Button, Card, Input, Label, Skeleton, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getInvoiceSettings,
  saveInvoiceSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsInvoiceSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState<boolean>(!!defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={name} className="text-[13px] text-[var(--st-text)]">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">{description}</p>
        ) : null}
      </div>
      <Switch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function InvoiceSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WsInvoiceSetting | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveInvoiceSettings,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const s = await getInvoiceSettings();
      setSettings(s);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  return (
    <EntityListShell
      title="Invoice Settings"
      subtitle="Invoice numbering, tax behaviour, defaults, and reminder rules."
    >

      {isLoading && !settings ? (
        <Card className="p-6">
          <Skeleton className="h-[480px] w-full" />
        </Card>
      ) : (
        <Card className="p-6">
          <form action={formAction} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Invoice Numbering
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="invoice_prefix" className="text-[13px] text-[var(--st-text)]">
                    Prefix
                  </Label>
                  <Input
                    id="invoice_prefix"
                    name="invoice_prefix"
                    defaultValue={settings?.invoice_prefix ?? 'INV'}
                    placeholder="INV"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice_digit" className="text-[13px] text-[var(--st-text)]">
                    Digits
                  </Label>
                  <Input
                    id="invoice_digit"
                    name="invoice_digit"
                    type="number"
                    min={1}
                    defaultValue={String(settings?.invoice_digit ?? 6)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="invoice_number_separator"
                    className="text-[13px] text-[var(--st-text)]"
                  >
                    Separator
                  </Label>
                  <Input
                    id="invoice_number_separator"
                    name="invoice_number_separator"
                    defaultValue={settings?.invoice_number_separator ?? '-'}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Terms & Tax
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="due_after_days" className="text-[13px] text-[var(--st-text)]">
                    Default Due (days)
                  </Label>
                  <Input
                    id="due_after_days"
                    name="due_after_days"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.due_after_days ?? 30)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_calculation" className="text-[13px] text-[var(--st-text)]">
                    Tax Calculation
                  </Label>
                  <div className="mt-1.5">
                    <EnumFormField
                      name="tax_calculation"
                      enumName="taxCalculationBasis"
                      initialId={settings?.tax_calculation ?? 'before-discount'}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="hsn_sac_label" className="text-[13px] text-[var(--st-text)]">
                    HSN/SAC Label
                  </Label>
                  <Input
                    id="hsn_sac_label"
                    name="hsn_sac_label"
                    defaultValue={settings?.hsn_sac_label ?? 'HSN/SAC'}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Display
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  name="show_tax_column"
                  label="Show tax column"
                  defaultChecked={settings?.show_tax_column ?? true}
                />
                <ToggleRow
                  name="show_notes"
                  label="Show notes section"
                  defaultChecked={settings?.show_notes ?? true}
                />
                <ToggleRow
                  name="show_terms"
                  label="Show terms section"
                  defaultChecked={settings?.show_terms ?? true}
                />
                <ToggleRow
                  name="enable_qr_code"
                  label="Embed QR code on invoice"
                  defaultChecked={settings?.enable_qr_code ?? false}
                />
                <ToggleRow
                  name="enable_einvoice"
                  label="Enable e-invoicing"
                  description="GST IRP integration for Indian customers"
                  defaultChecked={settings?.enable_einvoice ?? false}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Defaults
              </h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="default_note" className="text-[13px] text-[var(--st-text)]">
                    Default Note
                  </Label>
                  <Textarea
                    id="default_note"
                    name="default_note"
                    rows={3}
                    defaultValue={settings?.default_note ?? ''}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="default_terms" className="text-[13px] text-[var(--st-text)]">
                    Default Terms
                  </Label>
                  <Textarea
                    id="default_terms"
                    name="default_terms"
                    rows={3}
                    defaultValue={settings?.default_terms ?? ''}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Reminders
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  name="send_reminder_before_due"
                  label="Send reminder before due date"
                  defaultChecked={settings?.send_reminder_before_due ?? false}
                />
                <div>
                  <Label
                    htmlFor="reminder_days_before"
                    className="text-[13px] text-[var(--st-text)]"
                  >
                    Days Before Due
                  </Label>
                  <Input
                    id="reminder_days_before"
                    name="reminder_days_before"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.reminder_days_before ?? 3)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Invoice Settings
              </Button>
            </div>
          </form>
        </Card>
      )}
    </EntityListShell>
  );
}
