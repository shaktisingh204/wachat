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
import { LoaderCircle, Plus, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmClient } from '@/app/actions/crm.actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';

const initialState: { message?: string; error?: string; newClient?: any } = { message: undefined, error: undefined, newClient: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Save Client
    </Button>
  );
}

interface CrmAddClientDialogProps {
  onClientAdded: (client?: any) => void;
  defaultOpen?: boolean;
  defaultName?: string;
}

import { SmartLocationSelect } from '@/components/crm/smart-location-select';

// ... imports

export function CrmAddClientDialog({ onClientAdded, defaultOpen = false, defaultName = '' }: CrmAddClientDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [formState, formAction] = useActionState(addCrmClient, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // Location State
  const [country, setCountry] = useState<string>('IN'); // Default India ISO
  const [countryName, setCountryName] = useState<string>('India');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedStateName, setSelectedStateName] = useState<string>('');
  const [cityName, setCityName] = useState<string>('');

  const [addressCountry, setAddressCountry] = useState<string>('');
  const [addressCountryName, setAddressCountryName] = useState<string>('');
  const [addressState, setAddressState] = useState<string>('');
  const [addressStateName, setAddressStateName] = useState<string>('');
  const [addressCityName, setAddressCityName] = useState<string>('');

  // Sync internal open state if defaultOpen changes (though usually managed internally)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (formState.message) {
      toast({ title: 'Success!', description: formState.message });
      formRef.current?.reset();
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
            <DialogTitle>Create a New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your CRM. Required fields are marked with an asterisk.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Accordion type="multiple" defaultValue={['basic', 'address']} className="w-full">
              <AccordionItem value="basic">
                <AccordionTrigger>Basic Information</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="logo">Upload Logo</Label>
                    <Input id="logo" name="logo" type="file" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input id="businessName" name="businessName" maxLength={100} required defaultValue={defaultName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientIndustry">Client Industry</Label>
                      <Select name="clientIndustry"><SelectTrigger><SelectValue placeholder="-Select an Industry-" /></SelectTrigger><SelectContent><SelectItem value="tech">Technology</SelectItem><SelectItem value="retail">Retail</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <SmartLocationSelect
                        type="country"
                        onSelect={(val, label) => {
                          setCountry(val);
                          setCountryName(label);
                        }}
                      />
                      <input type="hidden" name="country" value={countryName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <SmartLocationSelect
                        type="state"
                        selectedCountryCode={country}
                        onSelect={(val, label) => {
                          setSelectedState(val);
                          setSelectedStateName(label);
                        }}
                      />
                      <input type="hidden" name="state" value={selectedStateName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City/Town</Label>
                      <SmartLocationSelect
                        type="city"
                        selectedCountryCode={country}
                        selectedStateCode={selectedState}
                        onSelect={(val, label) => setCityName(label)}
                      />
                      <input type="hidden" name="city" value={cityName} />
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
                      <SmartLocationSelect
                        type="country"
                        onSelect={(val, label) => {
                          setAddressCountry(val);
                          setAddressCountryName(label);
                        }}
                      />
                      <input type="hidden" name="addressCountry" value={addressCountryName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressState">State</Label>
                      <SmartLocationSelect
                        type="state"
                        selectedCountryCode={addressCountry}
                        onSelect={(val, label) => {
                          setAddressState(val);
                          setAddressStateName(label);
                        }}
                      />
                      <input type="hidden" name="addressState" value={addressStateName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressCity">City</Label>
                      <SmartLocationSelect
                        type="city"
                        selectedCountryCode={addressCountry}
                        selectedStateCode={addressState}
                        onSelect={(val, label) => setAddressCityName(label)}
                      />
                      <input type="hidden" name="addressCity" value={addressCityName} />
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
                  <div className="space-y-2"><Label>Attachments</Label><Input type="file" multiple /></div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="account-details">
                <AccordionTrigger>Account Details (Optional)</AccordionTrigger>
                <AccordionContent className="pt-2 text-center text-muted-foreground">
                  <p className="text-sm">Enable Advanced Accounting to create or link ledger.</p>
                  <Button variant="outline" size="sm" className="mt-2" disabled>Enable Now</Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}