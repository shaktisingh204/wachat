'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Card, Checkbox, Input, Label, RadioGroup, RadioGroupItem, useToast } from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save, Truck, Upload, X } from 'lucide-react';

import { saveCrmVendor, getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import { SabFilePickerButton } from '@/components/sabfiles';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CrmAddBankAccountDialog } from '@/components/zoruui-domain/crm-add-bank-account-dialog';
import type { BankAccountDetails, CrmVendor, WithId } from '@/lib/definitions';

import { EntityPicker } from '@/components/crm/entity-picker';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const initialState: { message: string; error: string } = { message: '', error: '' };

function SubmitButton({ isEdit }: { isEdit: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {isEdit ? 'Save Changes' : 'Add Vendor'}
        </Button>
    );
}

export default function NewVendorPage() {
    const [state, formAction] = useActionState(saveCrmVendor, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editVendorId = searchParams?.get('vendorId') ?? '';
    const isEdit = Boolean(editVendorId);
    const [vendor, setVendor] = useState<WithId<CrmVendor> | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [bankDetails, setBankDetails] = useState<Partial<BankAccountDetails>>({});
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);

    useEffect(() => {
        if (!editVendorId) return;
        let cancelled = false;
        (async () => {
            const v = await getCrmVendorById(editVendorId);
            if (!cancelled) {
                setVendor(v);
                if (v) {
                    setIsMsme(Boolean((v as any).isMsme));
                    setUdyamRegistrationNumber(String((v as any).udyamRegistrationNumber ?? ''));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [editVendorId]);

    // Location picker state — one id per field
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

    // MSME / §43B(h) compliance section (§6.10).
    const [countryError, setCountryError] = useState<string>('');
    const [isMsme, setIsMsme] = useState<boolean>(false);
    const [udyamRegistrationNumber, setUdyamRegistrationNumber] = useState<string>('');
    const udyamWarning =
        isMsme && udyamRegistrationNumber.trim().length === 0
            ? 'Udyam Registration Number is recommended when "MSME-registered" is on.'
            : isMsme &&
                !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/i.test(udyamRegistrationNumber.trim())
              ? 'Udyam Registration Number looks malformed (expected UDYAM-XX-NN-NNNNNNN).'
              : '';

    useEffect(() => {
        // Skip the initial mount — state is still the module-level initialState
        // object so we can safely bail out with a reference equality check.
        if (state === initialState) return;

        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/purchases/vendors');
            return;
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <EntityListShell
            title={isEdit ? 'Edit Vendor' : 'New Vendor'}
            subtitle={
                isEdit
                    ? `Update details for ${vendor?.name ?? 'this vendor'}.`
                    : 'Enter the details for the new vendor or supplier.'
            }
        >
            <CrmAddBankAccountDialog
                isOpen={isBankDialogOpen}
                onOpenChange={setIsBankDialogOpen}
                onSave={(details) => setBankDetails(details)}
            />

            <form
                ref={formRef}
                key={vendor?._id?.toString() ?? 'new'}
                action={formAction}
                onSubmit={(e) => {
                    if (!countryId.trim()) {
                        e.preventDefault();
                        setCountryError('Country is required.');
                        const el = formRef.current?.querySelector<HTMLElement>('[name="country"]');
                        el?.focus();
                    } else {
                        setCountryError('');
                    }
                }}
            >
                {isEdit && <input type="hidden" name="vendorId" value={editVendorId} />}
                <input type="hidden" name="bankAccountDetails" value={JSON.stringify(bankDetails)} />
                <input type="hidden" name="logoUrl" value={logoUrl} />
                <input type="hidden" name="attachmentUrls" value={JSON.stringify(attachmentUrls.map(a => a.url))} />
                <Card>
                    <Accordion type="multiple" defaultValue={['basic', 'tax', 'address', 'additional']} className="w-full">
                        <AccordionItem value="basic">
                            <AccordionTrigger>Basic Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="logo">Upload Logo</Label>
                                    <div className="flex items-center gap-2">
                                        <SabFilePickerButton
                                            accept="image"
                                            title="Pick vendor logo"
                                            onPick={({ url, name }) => {
                                                setLogoUrl(url);
                                                setLogoFileName(name);
                                            }}
                                        >
                                            <Upload /> {logoUrl ? 'Replace logo' : 'Choose logo'}
                                        </SabFilePickerButton>
                                        {logoUrl && (
                                            <>
                                                <span className="text-[12.5px] text-[var(--st-text-secondary)] truncate max-w-[240px]">{logoFileName || logoUrl}</span>
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
                                <div className="space-y-2">
                                    <Label htmlFor="name">Vendor&apos;s Business Name *</Label>
                                    <Input id="name" name="name" required maxLength={100} defaultValue={vendor?.name ?? ''} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientIndustry">Vendor Industry</Label>
                                    <EnumFormField
                                        enumName="vendorIndustry"
                                        name="clientIndustry"
                                        placeholder="-Select an Industry-"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="country">Country *</Label>
                                        <EntityPicker
                                            entity="country"
                                            value={countryId || null}
                                            placeholder="Select country"
                                            onChange={(next) => {
                                                const val = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setCountryId(val);
                                                if (val) setCountryError('');
                                                // Reset cascaded fields when country changes.
                                                setStateId('');
                                                setCityId('');
                                            }}
                                        />
                                        <input type="hidden" name="country" value={countryId} />
                                        {countryError ? (
                                            <p className="text-[11.5px] text-red-500">{countryError}</p>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state">State</Label>
                                        <EntityPicker
                                            entity="state"
                                            value={stateId || null}
                                            placeholder="Select state"
                                            filter={countryId ? { countryCode: countryId } : undefined}
                                            disabled={!countryId}
                                            onChange={(next) => {
                                                const val = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setStateId(val);
                                                // Reset city when state changes.
                                                setCityId('');
                                            }}
                                        />
                                        <input type="hidden" name="state" value={stateId} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City/Town</Label>
                                        <EntityPicker
                                            entity="city"
                                            value={cityId || null}
                                            placeholder="Select city"
                                            filter={
                                                countryId || stateId
                                                    ? {
                                                          ...(countryId ? { countryCode: countryId } : {}),
                                                          // stateId format is "CC:SC"; extract just the state code.
                                                          ...(stateId ? { stateCode: stateId.includes(':') ? stateId.split(':')[1] : stateId } : {}),
                                                      }
                                                    : undefined
                                            }
                                            disabled={!countryId}
                                            onChange={(next) => setCityId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                                        />
                                        <input type="hidden" name="city" value={cityId} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="tax">
                            <AccordionTrigger>Tax Information (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Business GSTIN</Label><Input name="gstin" maxLength={15} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                    <div className="space-y-2"><Label>Business PAN</Label><Input name="pan" maxLength={10} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                </div>
                                <div className="space-y-2"><Label>Name as Per PAN</Label><Input name="panName" maxLength={100} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Vendor Type</Label><RadioGroup name="vendorType" defaultValue="individual" className="flex gap-4 pt-2"><div className="flex items-center space-x-2"><RadioGroupItem value="individual" id="type-individual" /><Label htmlFor="type-individual" className="font-normal">Individual</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="company" id="type-company" /><Label htmlFor="type-company" className="font-normal">Company</Label></div></RadioGroup></div>
                                    <div className="space-y-2"><Label>Tax Treatment</Label><EnumFormField enumName="taxTreatment" name="taxTreatment" placeholder="Select..." /></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="address">
                            <AccordionTrigger>Address (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Country</Label>
                                        <EntityPicker
                                            entity="country"
                                            value={addressCountryId || null}
                                            placeholder="Select country"
                                            onChange={(next) => {
                                                const val = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setAddressCountryId(val);
                                                setAddressStateId('');
                                                setAddressCityId('');
                                            }}
                                        />
                                        <input type="hidden" name="addressCountry" value={addressCountryId} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>State / Province</Label>
                                        <EntityPicker
                                            entity="state"
                                            value={addressStateId || null}
                                            placeholder="Select state"
                                            filter={addressCountryId ? { countryCode: addressCountryId } : undefined}
                                            disabled={!addressCountryId}
                                            onChange={(next) => {
                                                const val = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setAddressStateId(val);
                                                setAddressCityId('');
                                            }}
                                        />
                                        <input type="hidden" name="addressState" value={addressStateId} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>City</Label>
                                        <EntityPicker
                                            entity="city"
                                            value={addressCityId || null}
                                            placeholder="Select city"
                                            filter={
                                                addressCountryId || addressStateId
                                                    ? {
                                                          ...(addressCountryId ? { countryCode: addressCountryId } : {}),
                                                          ...(addressStateId ? { stateCode: addressStateId.includes(':') ? addressStateId.split(':')[1] : addressStateId } : {}),
                                                      }
                                                    : undefined
                                            }
                                            disabled={!addressCountryId}
                                            onChange={(next) => setAddressCityId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                                        />
                                        <input type="hidden" name="addressCity" value={addressCityId} />
                                    </div>
                                </div>
                                <div className="space-y-2"><Label>Postal Code / Zip Code</Label><Input name="pincode" maxLength={20} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                <div className="space-y-2"><Label>Street Address</Label><Input name="street" maxLength={200} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="msme">
                            <AccordionTrigger>MSME / Compliance (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                    India MSMED Act 2006 + IT §43B(h): bills owed to MSME-registered vendors
                                    must be cleared within 45 days (or 15 days if no written agreement). Late
                                    payment triggers interest u/s 16 + IT deduction disallowance.
                                </p>
                                <input type="hidden" name="isMsme" value={isMsme ? 'true' : 'false'} />
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="isMsme"
                                        checked={isMsme}
                                        onCheckedChange={(v) => setIsMsme(Boolean(v))}
                                    />
                                    <Label htmlFor="isMsme" className="font-normal">
                                        This vendor is MSME-registered (Udyam)
                                    </Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="udyamRegistrationNumber">
                                            Udyam Registration Number
                                        </Label>
                                        <Input
                                            id="udyamRegistrationNumber"
                                            name="udyamRegistrationNumber"
                                            placeholder="UDYAM-XX-NN-NNNNNNN"
                                            maxLength={32}
                                            value={udyamRegistrationNumber}
                                            onChange={(e) => setUdyamRegistrationNumber(e.target.value)}
                                            className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                                            disabled={!isMsme}
                                        />
                                        {udyamWarning ? (
                                            <p className="text-[11.5px] text-[var(--st-text)]">{udyamWarning}</p>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="msmeCategory">MSME Category</Label>
                                        <EnumFormField
                                            enumName="msmeCategory"
                                            name="msmeCategory"
                                            initialId={(vendor as any)?.msmeCategory ?? ''}
                                            placeholder="Select category"
                                            disabled={!isMsme}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="msmePaymentTermsDays">
                                        Payment terms (days, default 45)
                                    </Label>
                                    <Input
                                        id="msmePaymentTermsDays"
                                        name="msmePaymentTermsDays"
                                        type="number"
                                        min={1}
                                        max={180}
                                        placeholder="45"
                                        defaultValue={
                                            (vendor as any)?.msmePaymentTermsDays
                                                ? String((vendor as any).msmePaymentTermsDays)
                                                : ''
                                        }
                                        className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                                        disabled={!isMsme}
                                    />
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Override only when a written agreement specifies a shorter window.
                                    </p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="additional">
                            <AccordionTrigger>Additional Details (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-2"><Label htmlFor="displayName">Display Name</Label><Input id="displayName" name="displayName" maxLength={100} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" name="email" type="email" maxLength={100} defaultValue={vendor?.email ?? ''} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" />
                                        <div className="flex items-center space-x-2"><Checkbox id="show-email" /><Label htmlFor="show-email" className="font-normal text-xs">Show in Invoice</Label></div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone No.</Label>
                                        <Input id="phone" name="phone" maxLength={30} defaultValue={vendor?.phone ?? ''} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" />
                                        <div className="flex items-center space-x-2"><Checkbox id="show-phone" /><Label htmlFor="show-phone" className="font-normal text-xs">Show in Invoice</Label></div>
                                    </div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" placeholder="Brief 4-5 words on what they&rsquo;re looking for" maxLength={100} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" /></div>
                                <div className="space-y-2">
                                    <Label>Attachments</Label>
                                    <div className="flex flex-col gap-2">
                                        <SabFilePickerButton
                                            accept="all"
                                            title="Add an attachment"
                                            onPick={({ url, name }) => {
                                                setAttachmentUrls((prev) => [...prev, { url, name }]);
                                            }}
                                        >
                                            <Upload /> Add attachment
                                        </SabFilePickerButton>
                                        {attachmentUrls.length > 0 && (
                                            <ul className="flex flex-col gap-1.5">
                                                {attachmentUrls.map((a, idx) => (
                                                    <li key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-2 py-1.5">
                                                        <span className="text-[12.5px] text-[var(--st-text)] truncate">{a.name}</span>
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
                        <AccordionItem value="bank">
                            <AccordionTrigger>Bank Account Details (Optional)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <p className="text-[12.5px] text-[var(--st-text-secondary)]">Record all payments made to your Vendor&apos;s Bank Accounts against this and future Purchases.</p>
                                {bankDetails.accountNumber ? (
                                    <div className="p-3 rounded-lg border border-[var(--st-border)]">
                                        <p className="font-medium text-[var(--st-text)]">{bankDetails.accountHolder}</p>
                                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">Account: {bankDetails.accountNumber}</p>
                                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">IFSC: {bankDetails.ifsc}</p>
                                        <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsBankDialogOpen(true)}>Edit Details</Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                                        Add Bank Account
                                    </Button>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="account-details">
                            <AccordionTrigger>Account Details (Optional)</AccordionTrigger>
                            <AccordionContent className="pt-2 text-center text-[var(--st-text-secondary)]">
                                <p className="text-[13px]">Enable Advanced Accounting to create or link ledger.</p>
                                <Button variant="outline" size="sm" className="mt-2" disabled>Enable Now</Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end pt-6">
                        <SubmitButton isEdit={isEdit} />
                    </div>
                </Card>
            </form>
        </EntityListShell>
    )
}
