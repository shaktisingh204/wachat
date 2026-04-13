'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SmartLocationSelect } from '@/components/crm/smart-location-select';
import { SmartIndustrySelect } from '@/components/crm/inventory/smart-industry-select';
import { SmartVendorTypeSelect } from '@/components/crm/purchases/smart-vendor-type-select';
import { ClayButton } from '@/components/clay';

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

    // Location State
    const [country, setCountry] = useState<string>('IN');
    const [countryName, setCountryName] = useState<string>('India');
    const [selectedState, setSelectedState] = useState<string>('');
    const [selectedStateName, setSelectedStateName] = useState<string>('');
    const [cityName, setCityName] = useState('New Delhi');
    const [vendorType, setVendorType] = useState('Goods Supplier');
    const [industryId, setIndustryId] = useState<string>('');

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
                    <DialogTitle className="text-clay-ink">Add New Vendor</DialogTitle>
                    <DialogDescription className="text-clay-ink-muted">
                        Enter the details of the new vendor here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-clay-ink">Business/Vendor Name *</Label>
                            <Input id="name" name="name" required maxLength={100} defaultValue={defaultName} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="displayName" className="text-clay-ink">Display Name</Label>
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
                                        <SmartIndustrySelect
                                            onSelect={(val) => setIndustryId(val)}
                                        />
                                        <input type="hidden" name="industryId" value={industryId} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="country">Country</Label>
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
                                        <input type="hidden" name="vendorType" value={vendorType} />
                                        <SmartVendorTypeSelect
                                            value={vendorType}
                                            onSelect={(val: string) => setVendorType(val)}
                                        />
                                    </div>
                                    <div className="space-y-2"><Label>Tax Treatment</Label><Select name="taxTreatment"><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="registered">Registered</SelectItem><SelectItem value="unregistered">Unregistered</SelectItem></SelectContent></Select></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <DialogFooter>
                        <ClayButton type="button" variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
                        <ClayButton type="submit" variant="obsidian">Save Vendor</ClayButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
