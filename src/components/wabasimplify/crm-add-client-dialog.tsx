

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
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmClient } from '@/app/actions/crm.actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';

const initialState = { message: null, error: null };

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
  onClientAdded: () => void;
}

export function CrmAddClientDialog({ onClientAdded }: CrmAddClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addCrmClient, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onClientAdded();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onClientAdded]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form action={formAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Create a New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your CRM. Required fields are marked with an asterisk.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 my-4 px-6">
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
                      <Input id="businessName" name="businessName" maxLength={100} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientIndustry">Client Industry</Label>
                      <Select name="clientIndustry"><SelectTrigger><SelectValue placeholder="-Select an Industry-"/></SelectTrigger><SelectContent><SelectItem value="tech">Technology</SelectItem><SelectItem value="retail">Retail</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="country">Country *</Label>
                            <Select name="country" defaultValue="India" required><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem><SelectItem value="USA">United States</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="city">City/Town</Label>
                            <Input id="city" name="city" maxLength={100} />
                        </div>
                   </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="tax">
                <AccordionTrigger>Tax Information (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                   <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="gstin">Business GSTIN</Label><Input id="gstin" name="gstin" maxLength={15} /></div>
                        <div className="space-y-2"><Label htmlFor="pan">Business PAN</Label><Input id="pan" name="pan" maxLength={10} /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Client Type</Label><Select name="clientType"><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Tax Treatment</Label><Select name="taxTreatment"><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="registered">Registered</SelectItem><SelectItem value="unregistered">Unregistered</SelectItem></SelectContent></Select></div>
                   </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="address">
                <AccordionTrigger>Address (Optional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2"><Label htmlFor="street">Street Address</Label><Input id="street" name="street" maxLength={200} /></div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label htmlFor="addressCity">City</Label><Input id="addressCity" name="addressCity" maxLength={100} /></div>
                        <div className="space-y-2"><Label htmlFor="addressState">State</Label><Input id="addressState" name="addressState" maxLength={100} /></div>
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
          </ScrollArea>
          <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
