'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, User, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CrmAddBankAccountDialog } from '@/components/wabasimplify/crm-add-bank-account-dialog';
import type { BankAccountDetails } from '@/lib/definitions';
import { Checkbox } from '@/components/ui/checkbox';

import { SmartLocationSelect } from '@/components/crm/smart-location-select';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton type="submit" variant="obsidian" disabled={pending} leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
            Add Vendor
        </ClayButton>
    );
}

export default function NewVendorPage() {
    const [state, formAction] = useActionState(saveCrmVendor, initialState);
    const { toast } = useToast();
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
        <div className="max-w-4xl mx-auto flex w-full flex-col gap-6">
            <CrmAddBankAccountDialog
                isOpen={isBankDialogOpen}
                onOpenChange={setIsBankDialogOpen}
                onSave={(details) => setBankDetails(details)}
            />
            <div>
                <Link href="/dashboard/crm/purchases/vendors" className="inline-flex items-center gap-2 text-[13px] text-clay-ink-muted hover:text-clay-ink">
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
                <ClayCard>
                    <Accordion type="multiple" defaultValue={['basic', 'tax', 'address', 'additional']} className="w-full">
                        <AccordionItem value="basic">
                            <AccordionTrigger>Basic Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="logo">Upload Logo</Label>
                                    <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Vendor&apos;s Business Name *</Label>
                                    <Input id="name" name="name" required maxLength={100} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientIndustry">Vendor Industry</Label>
                                    <Select name="clientIndustry"><SelectTrigger><SelectValue placeholder="-Select an Industry-" /></SelectTrigger><SelectContent><SelectItem value="tech">Technology</SelectItem><SelectItem value="retail">Retail</SelectItem></SelectContent></Select>
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
                        <AccordionItem value="tax">
                            <AccordionTrigger>Tax Information (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Business GSTIN</Label><Input name="gstin" maxLength={15} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                    <div className="space-y-2"><Label>Business PAN</Label><Input name="pan" maxLength={10} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                </div>
                                <div className="space-y-2"><Label>Name as Per PAN</Label><Input name="panName" maxLength={100} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Vendor Type</Label><RadioGroup name="vendorType" defaultValue="individual" className="flex gap-4 pt-2"><div className="flex items-center space-x-2"><RadioGroupItem value="individual" id="type-individual" /><Label htmlFor="type-individual" className="font-normal">Individual</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="company" id="type-company" /><Label htmlFor="type-company" className="font-normal">Company</Label></div></RadioGroup></div>
                                    <div className="space-y-2"><Label>Tax Treatment</Label><Select name="taxTreatment"><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="registered">Registered</SelectItem><SelectItem value="unregistered">Unregistered</SelectItem></SelectContent></Select></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="address">
                            <AccordionTrigger>Address (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Country</Label>
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
                                        <Label>State / Province</Label>
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
                                        <Label>City</Label>
                                        <SmartLocationSelect
                                            type="city"
                                            selectedCountryCode={addressCountry}
                                            selectedStateCode={addressState}
                                            onSelect={(val, label) => setAddressCityName(label)}
                                        />
                                        <input type="hidden" name="addressCity" value={addressCityName} />
                                    </div>
                                </div>
                                <div className="space-y-2"><Label>Postal Code / Zip Code</Label><Input name="pincode" maxLength={20} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                <div className="space-y-2"><Label>Street Address</Label><Input name="street" maxLength={200} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="additional">
                            <AccordionTrigger>Additional Details (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2"><Label htmlFor="displayName">Display Name</Label><Input id="displayName" name="displayName" maxLength={100} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" name="email" type="email" maxLength={100} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                        <div className="flex items-center space-x-2"><Checkbox id="show-email" /><Label htmlFor="show-email" className="font-normal text-xs">Show in Invoice</Label></div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone No.</Label>
                                        <Input id="phone" name="phone" maxLength={30} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                        <div className="flex items-center space-x-2"><Checkbox id="show-phone" /><Label htmlFor="show-phone" className="font-normal text-xs">Show in Invoice</Label></div>
                                    </div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" placeholder="Brief 4-5 words on what they&rsquo;re looking for" maxLength={100} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                                <div className="space-y-2"><Label>Attachments</Label><Input type="file" multiple className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="bank">
                            <AccordionTrigger>Bank Account Details (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <p className="text-[12.5px] text-clay-ink-muted">Record all payments made to your Vendor&apos;s Bank Accounts against this and future Purchases.</p>
                                {bankDetails.accountNumber ? (
                                    <div className="p-3 rounded-clay-md border border-clay-border">
                                        <p className="font-medium text-clay-ink">{bankDetails.accountHolder}</p>
                                        <p className="text-[12.5px] text-clay-ink-muted">Account: {bankDetails.accountNumber}</p>
                                        <p className="text-[12.5px] text-clay-ink-muted">IFSC: {bankDetails.ifsc}</p>
                                        <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</Button>
                                    </div>
                                ) : (
                                    <ClayButton type="button" variant="pill" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Account
                                    </ClayButton>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="account-details">
                            <AccordionTrigger>Account Details (Optional)</AccordionTrigger>
                            <AccordionContent className="pt-2 text-center text-clay-ink-muted">
                                <p className="text-[13px]">Enable Advanced Accounting to create or link ledger.</p>
                                <ClayButton variant="pill" size="sm" className="mt-2" disabled>Enable Now</ClayButton>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end pt-6">
                        <SubmitButton />
                    </div>
                </ClayCard>
            </form>
        </div>
    )
}
