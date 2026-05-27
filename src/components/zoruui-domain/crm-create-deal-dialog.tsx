'use client';

import {
  Button,
  DatePicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Plus } from 'lucide-react';
import { createCrmDeal } from '@/app/actions/crm-deals.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WithId, CrmContact, CrmAccount } from '@/lib/definitions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Create Deal
    </Button>
  );
}

interface CreateDealDialogProps {
  contacts: WithId<CrmContact>[];
  accounts: WithId<CrmAccount>[];
  onDealCreated: () => void;
  dealStages: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  defaultContactId?: string;
  defaultAccountId?: string;
}

export function CreateDealDialog({
  contacts,
  accounts,
  onDealCreated,
  dealStages,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  defaultContactId,
  defaultAccountId,
}: CreateDealDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [state, formAction] = useActionState(createCrmDeal, initialState);
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [closeDate, setCloseDate] = useState<Date | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccountId || '');
  const lastHandledRef = useRef<typeof state | null>(null);

  // Custom-field definitions configured in CRM Settings → Custom Fields
  // for entity=deal. Loaded once when the dialog first opens.
  const [customFields, setCustomFields] = useState<WsCustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >({});
  const customFieldsLoadedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (customFieldsLoadedRef.current) return;
    customFieldsLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const defs = await getCustomFieldsFor('deal');
        if (!cancelled) setCustomFields((defs as WsCustomField[]) ?? []);
      } catch {
        // Non-fatal — the rest of the form still works.
        if (!cancelled) setCustomFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleCustomFieldChange = useCallback(
    (slug: string, next: CustomFieldValue) => {
      setCustomFieldValues((prev) => ({ ...prev, [slug]: next }));
    },
    [],
  );

  // Wrap the server action so we can serialize per-slug custom-field
  // values into the FormData under the `customFields` key (JSON-encoded
  // object keyed by `WsCustomField.name`). Matches the storage contract
  // consumed by `applyCustomFieldsToEntity`.
  const handleFormAction = useCallback(
    (formData: FormData) => {
      formData.set('customFields', JSON.stringify(customFieldValues));
      formAction(formData);
    },
    [formAction, customFieldValues],
  );

  useEffect(() => {
    if (lastHandledRef.current === state) return;
    if (state.message) {
      lastHandledRef.current = state;
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setCloseDate(undefined);
      setSelectedAccountId(defaultAccountId || '');
      setCustomFieldValues({});
      setOpen(false);
      onDealCreated();
    } else if (state.error) {
      lastHandledRef.current = state;
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onDealCreated, defaultAccountId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <ZoruDialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Deal
          </Button>
        </ZoruDialogTrigger>
      )}
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={handleFormAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="closeDate" value={closeDate?.toISOString()} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-zoru-ink">Create New Deal</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">Track a new sales opportunity.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2"><Label htmlFor="name" className="text-zoru-ink">Deal Name</Label><Input id="name" name="name" required placeholder="e.g. Website Redesign for Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="value" className="text-zoru-ink">Value</Label><Input id="value" name="value" type="number" step="0.01" required placeholder="10000" /></div>
                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-zoru-ink">Currency</Label>
                  <EntityFormField entity="currency" name="currency" initialId="USD" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stage" className="text-zoru-ink">Stage</Label>
                  <Select name="stage" defaultValue={dealStages[0]} required>
                    <ZoruSelectTrigger id="stage"><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {dealStages.map(stage => (
                        <ZoruSelectItem key={stage} value={stage}>{stage}</ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label className="text-zoru-ink">Expected Close Date</Label><DatePicker value={closeDate} onChange={setCloseDate} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId" className="text-zoru-ink">Account</Label>
                  <EntityFormField
                    entity="client"
                    name="accountId"
                    initialId={selectedAccountId || null}
                    placeholder="Select an account…"
                    onChange={(next) => setSelectedAccountId(next ?? '')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactId" className="text-zoru-ink">Primary Contact</Label>
                  <EntityFormField
                    entity="contact"
                    name="contactId"
                    initialId={defaultContactId || null}
                    required
                    placeholder="Select a contact…"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="probability" className="text-zoru-ink">Probability %</Label>
                  <Input id="probability" name="probability" type="number" min={0} max={100} placeholder="e.g. 60" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-zoru-ink">Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <ZoruSelectTrigger id="priority" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="low">Low</ZoruSelectItem>
                      <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                      <ZoruSelectItem value="high">High</ZoruSelectItem>
                      <ZoruSelectItem value="critical">Critical</ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadSource" className="text-zoru-ink">Lead Source</Label>
                  <EntityFormField entity="leadSource" name="leadSource" initialId="Other" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign" className="text-zoru-ink">Campaign</Label>
                  <Input id="campaign" name="campaign" placeholder="e.g. Q1 Launch" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextStep" className="text-zoru-ink">Next Step</Label>
                  <Input id="nextStep" name="nextStep" placeholder="e.g. Send proposal" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lossReason" className="text-zoru-ink">Loss Reason (if lost)</Label>
                  <Input id="lossReason" name="lossReason" placeholder="Optional" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
              </div>
              {customFields.length > 0 ? (
                <div className="space-y-3 border-t border-zoru-line pt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Custom Fields
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {customFields.map((f) => (
                      <CustomFieldInput
                        key={String(f._id ?? f.name)}
                        field={f}
                        value={customFieldValues[f.name]}
                        onChange={(next) => handleCustomFieldChange(f.name, next)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
