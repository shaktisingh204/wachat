'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Checkbox,
  Textarea,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Building, Upload, X } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';
import { useToast } from '@/hooks/use-toast';
import { addCrmClient } from '@/app/actions/crm.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { CustomFieldInput,
  type CustomFieldValue } from '@/components/crm/custom-field-input';

const initialState: { message?: string; error?: string; newClient?: any } = { message: undefined, error: undefined, newClient: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
    >
      Save Client
    </Button>
  );
}

interface CrmAddClientDialogProps {
  onClientAdded: (client?: any) => void;
  defaultOpen?: boolean;
  defaultName?: string;
}

import { EntityFormField } from '@/components/crm/entity-form-field';

// ... imports

export function CrmAddClientDialog({ onClientAdded, defaultOpen = false, defaultName = '' }: CrmAddClientDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [formState, formAction] = useActionState(addCrmClient, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // Picker id state — primary address uses country -> state -> city cascade.
  const [countryId, setCountryId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  // Optional secondary address (same cascade).
  const [addressCountryId, setAddressCountryId] = useState<string | null>(null);
  const [addressStateId, setAddressStateId] = useState<string | null>(null);

  // SabFiles-backed uploads
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [attachmentUrls, setAttachmentUrls] = useState<{ url: string; name: string }[]>([]);

  // Custom-field definitions for entity=account, plus the live edit
  // values keyed by `WsCustomField.name`. Loaded once on first dialog open.
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
        const defs = await getCustomFieldsFor('account');
        if (!cancelled) setCustomFields((defs as WsCustomField[]) ?? []);
      } catch {
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

  // Inject the JSON-encoded customFields blob into FormData so the
  // server action can call `applyCustomFieldsToEntity('account', ...)`
  // after the insert.
  const handleFormAction = useCallback(
    (formData: FormData) => {
      formData.set('customFields', JSON.stringify(customFieldValues));
      formAction(formData);
    },
    [formAction, customFieldValues],
  );

  // Sync internal open state if defaultOpen changes (though usually managed internally)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (formState.message) {
      toast({ title: 'Success!', description: formState.message });
      formRef.current?.reset();
      setLogoUrl('');
      setLogoFileName('');
      setAttachmentUrls([]);
      setCustomFieldValues({});
      setOpen(false);
      // Pass the new client back
      onClientAdded(formState.newClient);
    }
    if (formState.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, onClientAdded]);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        // Optional: reset default name or handle closure if needed
      }
    }}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" className={defaultName ? "hidden" : ""}>
          <Plus className="mr-2 h-4 w-4" />
          New Prospect
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={handleFormAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-zoru-ink">Create a New Client</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Add a new client to your CRM. Required fields are marked with an asterisk.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Accordion type="multiple" defaultValue={['basic', 'address']} className="w-full">
              <ZoruAccordionItem value="basic">
                <ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Upload Logo</Label>
                    <input type="hidden" name="logoUrl" value={logoUrl} />
                    <div className="flex items-center gap-2">
                      <SabFilePickerButton
                        accept="image"
                        title="Pick client logo"
                        onPick={({ url, name }) => {
                          setLogoUrl(url);
                          setLogoFileName(name);
                        }}
                      >
                        <Upload className="h-4 w-4" /> {logoUrl ? 'Replace logo' : 'Choose logo'}
                      </SabFilePickerButton>
                      {logoUrl && (
                        <>
                          <span className="text-xs text-zoru-ink-muted truncate max-w-[200px]">{logoFileName || logoUrl}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove logo"
                            onClick={() => {
                              setLogoUrl('');
                              setLogoFileName('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input id="businessName" name="businessName" maxLength={100} required defaultValue={defaultName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientIndustry">Client Industry</Label>
                      <EntityFormField entity="industry" name="clientIndustry" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <EntityFormField
                        entity="country"
                        name="country"
                        required
                        onChange={(next) => {
                          setCountryId(next);
                          setStateId(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <EntityFormField
                        entity="state"
                        name="state"
                        filter={countryId ? { countryCode: countryId } : undefined}
                        onChange={(next) => setStateId(next)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City/Town</Label>
                      <EntityFormField
                        entity="city"
                        name="city"
                        filter={
                          countryId
                            ? {
                                countryCode: countryId,
                                ...(stateId
                                  ? { stateCode: stateId.includes(':') ? stateId.split(':')[1] : stateId }
                                  : {}),
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              {/* ... Tax ... */}
              <ZoruAccordionItem value="address">
                <ZoruAccordionTrigger>Address (Optional)</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2"><Label htmlFor="street">Street Address</Label><Input id="street" name="street" maxLength={200} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="addressCountry">Country</Label>
                      <EntityFormField
                        entity="country"
                        name="addressCountry"
                        onChange={(next) => {
                          setAddressCountryId(next);
                          setAddressStateId(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressState">State</Label>
                      <EntityFormField
                        entity="state"
                        name="addressState"
                        filter={addressCountryId ? { countryCode: addressCountryId } : undefined}
                        onChange={(next) => setAddressStateId(next)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressCity">City</Label>
                      <EntityFormField
                        entity="city"
                        name="addressCity"
                        filter={
                          addressCountryId
                            ? {
                                countryCode: addressCountryId,
                                ...(addressStateId
                                  ? { stateCode: addressStateId.includes(':') ? addressStateId.split(':')[1] : addressStateId }
                                  : {}),
                              }
                            : undefined
                        }
                      />
                    </div>
                    <div className="space-y-2"><Label htmlFor="addressZip">ZIP Code</Label><Input id="addressZip" name="addressZip" maxLength={20} /></div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="shipping">
                <ZoruAccordionTrigger>Shipping Details (Optional)</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2"><Checkbox id="copy-billing" /><Label htmlFor="copy-billing">Copy from billing address</Label></div>
                  <div className="space-y-2"><Label htmlFor="shippingName">Name</Label><Input id="shippingName" name="shippingName" maxLength={100} /></div>
                  <div className="space-y-2"><Label htmlFor="shippingStreet">Street Address</Label><Input id="shippingStreet" name="shippingStreet" maxLength={200} /></div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="additional">
                <ZoruAccordionTrigger>Additional Details (Optional)</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2"><Label htmlFor="alias">Business Alias</Label><Input id="alias" name="alias" maxLength={100} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={100} /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Phone No.</Label><Input id="phone" name="phone" maxLength={30} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <input type="hidden" name="attachmentUrls" value={JSON.stringify(attachmentUrls.map(a => a.url))} />
                    <div className="flex flex-col gap-2">
                      <SabFilePickerButton
                        accept="all"
                        title="Add an attachment"
                        onPick={({ url, name }) => {
                          setAttachmentUrls((prev) => [...prev, { url, name }]);
                        }}
                      >
                        <Upload className="h-4 w-4" /> Add attachment
                      </SabFilePickerButton>
                      {attachmentUrls.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {attachmentUrls.map((a, idx) => (
                            <li key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-md border border-zoru-line px-2 py-1.5">
                              <span className="text-xs text-zoru-ink truncate">{a.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${a.name}`}
                                onClick={() =>
                                  setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="enterprise">
                <ZoruAccordionTrigger>Enterprise Details (Optional)</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gstin" className="text-zoru-ink">GSTIN</Label>
                      <Input id="gstin" name="gstin" placeholder="08XXXXXXXX1Z5" maxLength={20} className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pan" className="text-zoru-ink">PAN</Label>
                      <Input id="pan" name="pan" placeholder="ABCDE1234F" maxLength={20} className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingAddress" className="text-zoru-ink">Billing Address</Label>
                    <Textarea id="billingAddress" name="billingAddress" rows={3} className="rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingAddress" className="text-zoru-ink">Shipping Address</Label>
                    <Textarea id="shippingAddress" name="shippingAddress" rows={3} className="rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="annualRevenue" className="text-zoru-ink">Annual Revenue</Label>
                      <Input id="annualRevenue" name="annualRevenue" type="number" min={0} placeholder="e.g. 1000000" className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeCount" className="text-zoru-ink">Employee Count</Label>
                      <Input id="employeeCount" name="employeeCount" type="number" min={0} placeholder="e.g. 250" className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountCurrency" className="text-zoru-ink">Currency</Label>
                      <EntityFormField entity="currency" name="accountCurrency" initialId="INR" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms" className="text-zoru-ink">Payment Terms</Label>
                      <Select name="paymentTerms" defaultValue="Net 30">
                        <ZoruSelectTrigger id="paymentTerms" className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="Immediate">Immediate</ZoruSelectItem>
                          <ZoruSelectItem value="Net 15">Net 15</ZoruSelectItem>
                          <ZoruSelectItem value="Net 30">Net 30</ZoruSelectItem>
                          <ZoruSelectItem value="Net 45">Net 45</ZoruSelectItem>
                          <ZoruSelectItem value="Net 60">Net 60</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-zoru-ink">Category</Label>
                      <Select name="category" defaultValue="regular">
                        <ZoruSelectTrigger id="category" className="h-10 rounded-lg border-zoru-line bg-zoru-surface text-[13px]"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="new">New</ZoruSelectItem>
                          <ZoruSelectItem value="strategic">Strategic</ZoruSelectItem>
                          <ZoruSelectItem value="key">Key</ZoruSelectItem>
                          <ZoruSelectItem value="regular">Regular</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="account-details">
                <ZoruAccordionTrigger>Account Details (Optional)</ZoruAccordionTrigger>
                <ZoruAccordionContent className="pt-2 text-center text-zoru-ink-muted">
                  <p className="text-sm">Enable Advanced Accounting to create or link ledger.</p>
                  <Button variant="outline" size="sm" className="mt-2" disabled>Enable Now</Button>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              {customFields.length > 0 ? (
                <ZoruAccordionItem value="custom-fields">
                  <ZoruAccordionTrigger>Custom Fields</ZoruAccordionTrigger>
                  <ZoruAccordionContent className="space-y-4 pt-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      {customFields.map((f) => (
                        <CustomFieldInput
                          key={String(f._id ?? f.name)}
                          field={f}
                          value={customFieldValues[f.name]}
                          onChange={(next) =>
                            handleCustomFieldChange(f.name, next)
                          }
                        />
                      ))}
                    </div>
                  </ZoruAccordionContent>
                </ZoruAccordionItem>
              ) : null}
            </Accordion>
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