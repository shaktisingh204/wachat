'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useRef,
  useEffect,
  useActionState } from 'react';

import { Plus } from "lucide-react";
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState = {
    message: '',
    error: ''
};

interface CrmAddVendorDialogProps {
    onVendorAdded: (vendor?: any) => void;
    defaultOpen?: boolean;
    defaultName?: string;
}

export function CrmAddVendorDialog({ onVendorAdded, defaultOpen = false, defaultName = '' }: CrmAddVendorDialogProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [formState, formAction] = useActionState(saveCrmVendor, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    // Cascade state — country -> state -> city.
    const [countryId, setCountryId] = useState<string | null>(null);
    const [stateId, setStateId] = useState<string | null>(null);

    useEffect(() => {
        if (defaultOpen) setOpen(true);
    }, [defaultOpen]);

    useEffect(() => {
        if (formState.message) {
            toast({ title: 'Success!', description: formState.message });
            formRef.current?.reset();
            setOpen(false);
            onVendorAdded(formState.newVendor);
        }
        if (formState.error) {
            toast({ title: 'Error', description: formState.error, variant: 'destructive' });
        }
    }, [formState, toast, onVendorAdded]);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                // Optional: reset form or state on close
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className={defaultName ? "hidden" : ""}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Vendor
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-[var(--st-text)]">Add New Vendor</DialogTitle>
                    <DialogDescription className="text-[var(--st-text-secondary)]">
                        Enter the details of the new vendor here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-[var(--st-text)]">Business/Vendor Name *</Label>
                            <Input id="name" name="name" required maxLength={100} defaultValue={defaultName} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="displayName" className="text-[var(--st-text)]">Display Name</Label>
                            <Input id="displayName" name="displayName" maxLength={100} placeholder="Nickname (Optional)" />
                        </div>
                    </div>

                    <Accordion type="single" collapsible defaultValue="basic" className="w-full">
                        <AccordionItem value="basic">
                            <AccordionTrigger>Basic Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={100} /></div>
                                    <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" maxLength={20} /></div>
                                    <div className="space-y-2 col-span-2">
                                        <Label>Industry</Label>
                                        <EntityFormField entity="industry" name="industryId" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="country" className="text-[var(--st-text)]">Country</Label>
                                        <EntityFormField
                                            entity="country"
                                            name="country"
                                            onChange={(next) => {
                                                setCountryId(next);
                                                setStateId(null);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state" className="text-[var(--st-text)]">State</Label>
                                        <EntityFormField
                                            entity="state"
                                            name="state"
                                            filter={countryId ? { countryCode: countryId } : undefined}
                                            onChange={(next) => setStateId(next)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city" className="text-[var(--st-text)]">City/Town</Label>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="pincode">Pincode</Label><Input id="pincode" name="pincode" maxLength={20} /></div>
                                    <div className="space-y-2"><Label htmlFor="street">Street Address</Label><Input id="street" name="street" maxLength={200} /></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="financial">
                            <AccordionTrigger>Financial & Tax</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="gstin">GSTIN</Label><Input id="gstin" name="gstin" maxLength={15} /></div>
                                    <div className="space-y-2"><Label htmlFor="pan">PAN</Label><Input id="pan" name="pan" maxLength={10} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vendorType">Vendor Type</Label>
                                        <EntityFormField entity="vendorType" name="vendorType" />
                                    </div>
                                    <div className="space-y-2"><Label>Tax Treatment</Label><Select name="taxTreatment"><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="registered">Registered</SelectItem><SelectItem value="unregistered">Unregistered</SelectItem></SelectContent></Select></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Vendor</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
