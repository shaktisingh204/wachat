'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import {
    ZoruAccordion,
    ZoruAccordionContent,
    ZoruAccordionItem,
    ZoruAccordionTrigger,
    ZoruButton,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogTrigger,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    useZoruToast,
} from '@/components/zoruui';
import { Plus } from "lucide-react";
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { SmartLocationSelect } from '@/components/crm/smart-location-select';
import { SmartIndustrySelect } from '@/components/crm/inventory/smart-industry-select';
import { SmartVendorTypeSelect } from '@/components/crm/purchases/smart-vendor-type-select';

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
    const { toast } = useZoruToast();
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
        <ZoruDialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                // Optional: reset form or state on close
            }
        }}>
            <ZoruDialogTrigger asChild>
                <ZoruButton variant="outline" className={defaultName ? "hidden" : ""}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Vendor
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-zoru-ink">Add New Vendor</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-zoru-ink-muted">
                        Enter the details of the new vendor here. Click save when you're done.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name" className="text-zoru-ink">Business/Vendor Name *</ZoruLabel>
                            <ZoruInput id="name" name="name" required maxLength={100} defaultValue={defaultName} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="displayName" className="text-zoru-ink">Display Name</ZoruLabel>
                            <ZoruInput id="displayName" name="displayName" maxLength={100} placeholder="Nickname (Optional)" />
                        </div>
                    </div>

                    <ZoruAccordion type="single" collapsible defaultValue="basic" className="w-full">
                        <ZoruAccordionItem value="basic">
                            <ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><ZoruLabel htmlFor="email">Email</ZoruLabel><ZoruInput id="email" name="email" type="email" maxLength={100} /></div>
                                    <div className="space-y-2"><ZoruLabel htmlFor="phone">Phone</ZoruLabel><ZoruInput id="phone" name="phone" maxLength={20} /></div>
                                    <div className="space-y-2 col-span-2">
                                        <ZoruLabel>Industry</ZoruLabel>
                                        <SmartIndustrySelect
                                            onSelect={(val) => setIndustryId(val)}
                                        />
                                        <input type="hidden" name="industryId" value={industryId} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="country" className="text-zoru-ink">Country</ZoruLabel>
                                        <SmartLocationSelect
                                            type="country"
                                            value={country}
                                            onSelect={(val, label) => {
                                                setCountry(val);
                                                setCountryName(label);
                                                // Country change invalidates the state + city below
                                                setSelectedState('');
                                                setSelectedStateName('');
                                                setCityName('');
                                            }}
                                        />
                                        <input type="hidden" name="country" value={countryName} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="state" className="text-zoru-ink">State</ZoruLabel>
                                        <SmartLocationSelect
                                            type="state"
                                            selectedCountryCode={country}
                                            value={selectedState}
                                            onSelect={(val, label) => {
                                                setSelectedState(val);
                                                setSelectedStateName(label);
                                                setCityName('');
                                            }}
                                        />
                                        <input type="hidden" name="state" value={selectedStateName} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="city" className="text-zoru-ink">City/Town</ZoruLabel>
                                        <SmartLocationSelect
                                            type="city"
                                            selectedCountryCode={country}
                                            selectedStateCode={selectedState}
                                            value={cityName}
                                            onSelect={(val, label) => setCityName(label)}
                                        />
                                        <input type="hidden" name="city" value={cityName} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><ZoruLabel htmlFor="pincode">Pincode</ZoruLabel><ZoruInput id="pincode" name="pincode" maxLength={20} /></div>
                                    <div className="space-y-2"><ZoruLabel htmlFor="street">Street Address</ZoruLabel><ZoruInput id="street" name="street" maxLength={200} /></div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>

                        <ZoruAccordionItem value="financial">
                            <ZoruAccordionTrigger>Financial & Tax</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><ZoruLabel htmlFor="gstin">GSTIN</ZoruLabel><ZoruInput id="gstin" name="gstin" maxLength={15} /></div>
                                    <div className="space-y-2"><ZoruLabel htmlFor="pan">PAN</ZoruLabel><ZoruInput id="pan" name="pan" maxLength={10} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="vendorType">Vendor Type</ZoruLabel>
                                        <input type="hidden" name="vendorType" value={vendorType} />
                                        <SmartVendorTypeSelect
                                            value={vendorType}
                                            onSelect={(val: string) => setVendorType(val)}
                                        />
                                    </div>
                                    <div className="space-y-2"><ZoruLabel>Tax Treatment</ZoruLabel><ZoruSelect name="taxTreatment"><ZoruSelectTrigger><ZoruSelectValue placeholder="Select..." /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="registered">Registered</ZoruSelectItem><ZoruSelectItem value="unregistered">Unregistered</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                    </ZoruAccordion>

                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <ZoruButton type="submit">Save Vendor</ZoruButton>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
