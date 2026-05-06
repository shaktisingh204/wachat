'use client';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger, ZoruButton, ZoruCard, ZoruCheckbox, ZoruInput, ZoruLabel, ZoruRadioGroup, ZoruRadioGroupItem, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, useZoruToast } from '@/components/zoruui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save, ArrowLeft, User, Truck } from 'lucide-react';

import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CrmAddBankAccountDialog } from '@/components/wabasimplify/crm-add-bank-account-dialog';
import type { BankAccountDetails } from '@/lib/definitions';

import { SmartLocationSelect } from '@/components/crm/smart-location-select';

import { CrmPageHeader } from '../../../_components/crm-page-header';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            Add Vendor
        </ZoruButton>
    );
}

export default function NewVendorPage() {
    const [state, formAction] = useActionState(saveCrmVendor, initialState);
    const { toast } = useZoruToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [bankDetails, setBankDetails] = useState<Partial<BankAccountDetails>>({});
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);

    // Location State
    const [country, setCountry] = useState<string>('IN');
    const [countryName, setCountryName] = useState<string>('India');
    const [selectedState, setSelectedState] = useState<string>('');
    const [selectedStateName, setSelectedStateName] = useState<string>('');
    const [cityName, setCityName] = useState<string>('');

    const [addressCountry, setAddressCountry] = useState<string>('');
    const [addressCountryName, setAddressCountryName] = useState<string>('');
    const [addressState, setAddressState] = useState<string>('');
    const [addressStateName, setAddressStateName] = useState<string>('');
    const [addressCityName, setAddressCityName] = useState<string>('');

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/purchases/vendors');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <div className="max-w-4xl flex w-full flex-col gap-6">
            <CrmAddBankAccountDialog
                isOpen={isBankDialogOpen}
                onOpenChange={setIsBankDialogOpen}
                onSave={(details) => setBankDetails(details)}
            />
            <div>
                <Link href="/dashboard/crm/purchases/vendors" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Vendors
                </Link>
            </div>

            <CrmPageHeader
                title="New Vendor"
                subtitle="Enter the details for the new vendor or supplier."
                icon={Truck}
            />

            <form action={formAction} ref={formRef}>
                <input type="hidden" name="bankAccountDetails" value={JSON.stringify(bankDetails)} />
                <ZoruCard>
                    <ZoruAccordion type="multiple" defaultValue={['basic', 'tax', 'address', 'additional']} className="w-full">
                        <ZoruAccordionItem value="basic">
                            <ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="logo">Upload Logo</ZoruLabel>
                                    <ZoruInput id="logo" name="logo" type="file" accept="image/jpeg,image/png" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="name">Vendor&apos;s Business Name *</ZoruLabel>
                                    <ZoruInput id="name" name="name" required maxLength={100} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="clientIndustry">Vendor Industry</ZoruLabel>
                                    <ZoruSelect name="clientIndustry"><ZoruSelectTrigger><ZoruSelectValue placeholder="-Select an Industry-" /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="tech">Technology</ZoruSelectItem><ZoruSelectItem value="retail">Retail</ZoruSelectItem></ZoruSelectContent></ZoruSelect>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="country">Country *</ZoruLabel>
                                        <SmartLocationSelect
                                            type="country"
                                            value={country}
                                            onSelect={(val, label) => {
                                                setCountry(val);
                                                setCountryName(label);
                                                setSelectedState('');
                                                setSelectedStateName('');
                                                setCityName('');
                                            }}
                                        />
                                        <input type="hidden" name="country" value={countryName} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="state">State</ZoruLabel>
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
                                        <ZoruLabel htmlFor="city">City/Town</ZoruLabel>
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
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="tax">
                            <ZoruAccordionTrigger>Tax Information (Optional)</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><ZoruLabel>Business GSTIN</ZoruLabel><ZoruInput name="gstin" maxLength={15} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                    <div className="space-y-2"><ZoruLabel>Business PAN</ZoruLabel><ZoruInput name="pan" maxLength={10} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                </div>
                                <div className="space-y-2"><ZoruLabel>Name as Per PAN</ZoruLabel><ZoruInput name="panName" maxLength={100} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><ZoruLabel>Vendor Type</ZoruLabel><ZoruRadioGroup name="vendorType" defaultValue="individual" className="flex gap-4 pt-2"><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="individual" id="type-individual" /><ZoruLabel htmlFor="type-individual" className="font-normal">Individual</ZoruLabel></div><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="company" id="type-company" /><ZoruLabel htmlFor="type-company" className="font-normal">Company</ZoruLabel></div></ZoruRadioGroup></div>
                                    <div className="space-y-2"><ZoruLabel>Tax Treatment</ZoruLabel><ZoruSelect name="taxTreatment"><ZoruSelectTrigger><ZoruSelectValue placeholder="Select..." /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="registered">Registered</ZoruSelectItem><ZoruSelectItem value="unregistered">Unregistered</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="address">
                            <ZoruAccordionTrigger>Address (Optional)</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <ZoruLabel>Country</ZoruLabel>
                                        <SmartLocationSelect
                                            type="country"
                                            value={addressCountry}
                                            onSelect={(val, label) => {
                                                setAddressCountry(val);
                                                setAddressCountryName(label);
                                                setAddressState('');
                                                setAddressStateName('');
                                                setAddressCityName('');
                                            }}
                                        />
                                        <input type="hidden" name="addressCountry" value={addressCountryName} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>State / Province</ZoruLabel>
                                        <SmartLocationSelect
                                            type="state"
                                            selectedCountryCode={addressCountry}
                                            value={addressState}
                                            onSelect={(val, label) => {
                                                setAddressState(val);
                                                setAddressStateName(label);
                                                setAddressCityName('');
                                            }}
                                        />
                                        <input type="hidden" name="addressState" value={addressStateName} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>City</ZoruLabel>
                                        <SmartLocationSelect
                                            type="city"
                                            selectedCountryCode={addressCountry}
                                            selectedStateCode={addressState}
                                            value={addressCityName}
                                            onSelect={(val, label) => setAddressCityName(label)}
                                        />
                                        <input type="hidden" name="addressCity" value={addressCityName} />
                                    </div>
                                </div>
                                <div className="space-y-2"><ZoruLabel>Postal Code / Zip Code</ZoruLabel><ZoruInput name="pincode" maxLength={20} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                <div className="space-y-2"><ZoruLabel>Street Address</ZoruLabel><ZoruInput name="street" maxLength={200} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="additional">
                            <ZoruAccordionTrigger>Additional Details (Optional)</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2"><ZoruLabel htmlFor="displayName">Display Name</ZoruLabel><ZoruInput id="displayName" name="displayName" maxLength={100} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="email">Email</ZoruLabel>
                                        <ZoruInput id="email" name="email" type="email" maxLength={100} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                        <div className="flex items-center space-x-2"><ZoruCheckbox id="show-email" /><ZoruLabel htmlFor="show-email" className="font-normal text-xs">Show in Invoice</ZoruLabel></div>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="phone">Phone No.</ZoruLabel>
                                        <ZoruInput id="phone" name="phone" maxLength={30} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                        <div className="flex items-center space-x-2"><ZoruCheckbox id="show-phone" /><ZoruLabel htmlFor="show-phone" className="font-normal text-xs">Show in Invoice</ZoruLabel></div>
                                    </div>
                                </div>
                                <div className="space-y-2"><ZoruLabel htmlFor="subject">Subject</ZoruLabel><ZoruInput id="subject" name="subject" placeholder="Brief 4-5 words on what they&rsquo;re looking for" maxLength={100} className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                                <div className="space-y-2"><ZoruLabel>Attachments</ZoruLabel><ZoruInput type="file" multiple className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="bank">
                            <ZoruAccordionTrigger>Bank Account Details (Optional)</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="space-y-4 pt-2">
                                <p className="text-[12.5px] text-muted-foreground">Record all payments made to your Vendor&apos;s Bank Accounts against this and future Purchases.</p>
                                {bankDetails.accountNumber ? (
                                    <div className="p-3 rounded-lg border border-border">
                                        <p className="font-medium text-foreground">{bankDetails.accountHolder}</p>
                                        <p className="text-[12.5px] text-muted-foreground">Account: {bankDetails.accountNumber}</p>
                                        <p className="text-[12.5px] text-muted-foreground">IFSC: {bankDetails.ifsc}</p>
                                        <ZoruButton variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</ZoruButton>
                                    </div>
                                ) : (
                                    <ZoruButton type="button" variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Account
                                    </ZoruButton>
                                )}
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="account-details">
                            <ZoruAccordionTrigger>Account Details (Optional)</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-2 text-center text-muted-foreground">
                                <p className="text-[13px]">Enable Advanced Accounting to create or link ledger.</p>
                                <ZoruButton variant="outline" size="sm" className="mt-2" disabled>Enable Now</ZoruButton>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                    </ZoruAccordion>

                    <div className="flex justify-end pt-6">
                        <SubmitButton />
                    </div>
                </ZoruCard>
            </form>
        </div>
    )
}
