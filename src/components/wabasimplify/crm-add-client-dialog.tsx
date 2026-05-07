'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Plus, Building, Upload, X } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';
import { useToast } from '@/hooks/use-toast';
import { addCrmClient } from '@/app/actions/crm.actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { ClayButton } from '@/components/clay';

const initialState: { message?: string; error?: string; newClient?: any } = { message: undefined, error: undefined, newClient: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
    >
      Save Client
    </ClayButton>
  );
}

interface CrmAddClientDialogProps {
  onClientAdded: (client?: any) => void;
  defaultOpen?: boolean;
  defaultName?: string;
}

import { EntityPicker } from '@/components/crm/entity-picker';

// ... imports

export function CrmAddClientDialog({ onClientAdded, defaultOpen = false, defaultName = '' }: CrmAddClientDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [formState, formAction] = useActionState(addCrmClient, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // Location State
  const [country, setCountry] = useState<string>('IN'); // Default India ISO
  const [countryName, setCountryName] = useState<string>('India');
  const [selectedCity, setSelectedCity] = useState('');
  const [clientIndustry, setClientIndustry] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedStateName, setSelectedStateName] = useState<string>('');
  const [cityName, setCityName] = useState<string>('');

  const [addressCountry, setAddressCountry] = useState<string>('');
  const [addressCountryName, setAddressCountryName] = useState<string>('');
  const [addressState, setAddressState] = useState<string>('');
  const [addressStateName, setAddressStateName] = useState<string>('');
  const [addressCityName, setAddressCityName] = useState<string>('');

  // EntityPicker id state (one per picker)
  const [clientIndustryId, setClientIndustryId] = useState<string>('');
  const [countryId, setCountryId] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [addressCountryId, setAddressCountryId] = useState<string>('');
  const [addressStateId, setAddressStateId] = useState<string>('');
  const [addressCityId, setAddressCityId] = useState<string>('');

  // SabFiles-backed uploads
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [attachmentUrls, setAttachmentUrls] = useState<{ url: string; name: string }[]>([]);

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
      <DialogTrigger asChild>
        <Button variant="outline" className={defaultName ? "hidden" : ""}>
          <Plus className="mr-2 h-4 w-4" />
          New Prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-foreground">Create a New Client</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new client to your CRM. Required fields are marked with an asterisk.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Accordion type="multiple" defaultValue={['basic', 'address']} className="w-full">
              <AccordionItem value="basic">
                <AccordionTrigger>Basic Information</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
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
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{logoFileName || logoUrl}</span>
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
                      {/* Hidden input to store value for form submission */}
                      <input type="hidden" name="clientIndustry" value={clientIndustryId} />
                      <EntityPicker
                        entity="industry"
                        value={clientIndustryId || null}
                        onChange={(next) => setClientIndustryId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <EntityPicker
                        entity="location"
                        value={countryId || null}
                        onChange={(next) => setCountryId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="country" value={countryId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <EntityPicker
                        entity="location"
                        value={stateId || null}
                        onChange={(next) => setStateId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="state" value={stateId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City/Town</Label>
                      <EntityPicker
                        entity="location"
                        value={cityId || null}
                        onChange={(next) => setCityId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="city" value={cityId} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              {/* ... Tax ... */}
              <AccordionItem value="address">
                <AccordionTrigger>Address (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2"><Label htmlFor="street">Street Address</Label><Input id="street" name="street" maxLength={200} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="addressCountry">Country</Label>
                      <EntityPicker
                        entity="location"
                        value={addressCountryId || null}
                        onChange={(next) => setAddressCountryId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="addressCountry" value={addressCountryId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressState">State</Label>
                      <EntityPicker
                        entity="location"
                        value={addressStateId || null}
                        onChange={(next) => setAddressStateId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="addressState" value={addressStateId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressCity">City</Label>
                      <EntityPicker
                        entity="location"
                        value={addressCityId || null}
                        onChange={(next) => setAddressCityId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                      />
                      <input type="hidden" name="addressCity" value={addressCityId} />
                    </div>
                    <div className="space-y-2"><Label htmlFor="addressZip">ZIP Code</Label><Input id="addressZip" name="addressZip" maxLength={20} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="shipping">
                <AccordionTrigger>Shipping Details (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2"><Checkbox id="copy-billing" /><Label htmlFor="copy-billing">Copy from billing address</Label></div>
                  <div className="space-y-2"><Label htmlFor="shippingName">Name</Label><Input id="shippingName" name="shippingName" maxLength={100} /></div>
                  <div className="space-y-2"><Label htmlFor="shippingStreet">Street Address</Label><Input id="shippingStreet" name="shippingStreet" maxLength={200} /></div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="additional">
                <AccordionTrigger>Additional Details (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
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
                            <li key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                              <span className="text-xs text-foreground truncate">{a.name}</span>
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
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="enterprise">
                <AccordionTrigger>Enterprise Details (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gstin" className="text-foreground">GSTIN</Label>
                      <Input id="gstin" name="gstin" placeholder="08XXXXXXXX1Z5" maxLength={20} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pan" className="text-foreground">PAN</Label>
                      <Input id="pan" name="pan" placeholder="ABCDE1234F" maxLength={20} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingAddress" className="text-foreground">Billing Address</Label>
                    <Textarea id="billingAddress" name="billingAddress" rows={3} className="rounded-lg border-border bg-card text-[13px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingAddress" className="text-foreground">Shipping Address</Label>
                    <Textarea id="shippingAddress" name="shippingAddress" rows={3} className="rounded-lg border-border bg-card text-[13px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="annualRevenue" className="text-foreground">Annual Revenue</Label>
                      <Input id="annualRevenue" name="annualRevenue" type="number" min={0} placeholder="e.g. 1000000" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeCount" className="text-foreground">Employee Count</Label>
                      <Input id="employeeCount" name="employeeCount" type="number" min={0} placeholder="e.g. 250" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountCurrency" className="text-foreground">Currency</Label>
                      <Input id="accountCurrency" name="accountCurrency" defaultValue="INR" placeholder="INR" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms" className="text-foreground">Payment Terms</Label>
                      <Select name="paymentTerms" defaultValue="Net 30">
                        <SelectTrigger id="paymentTerms" className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Immediate">Immediate</SelectItem>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-foreground">Category</Label>
                      <Select name="category" defaultValue="regular">
                        <SelectTrigger id="category" className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="strategic">Strategic</SelectItem>
                          <SelectItem value="key">Key</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="account-details">
                <AccordionTrigger>Account Details (Optional)</AccordionTrigger>
                <AccordionContent className="pt-2 text-center text-muted-foreground">
                  <p className="text-sm">Enable Advanced Accounting to create or link ledger.</p>
                  <ClayButton variant="pill" size="sm" className="mt-2" disabled>Enable Now</ClayButton>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <ClayButton type="button" variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}