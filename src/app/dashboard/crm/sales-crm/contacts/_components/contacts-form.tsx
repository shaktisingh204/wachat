'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { LoaderCircle,
  Save } from 'lucide-react';

/**
 * <ContactForm> — shared client form for `/new` and `/[contactId]/edit`.
 *
 * Drives both the `addCrmContact` (create) and `updateCrmContact` (edit)
 * server actions. The same component handles "Save", "Save & New",
 * and "Save & Add Deal" via a small `intent` parameter; the routing
 * decision happens here on the action's response.
 *
 * **Field name contract:** every named input matches what the actions
 * read via `formData.get(...)` (see `src/app/actions/crm.actions.ts`):
 *   name · email · phone · company · jobTitle · status · leadScore ·
 *   linkedinUrl · twitterHandle · lifecycleStage · source · owner ·
 *   tags · dateOfBirth · timezone · accountId · contactId (edit only).
 *
 * Extra fields (firstName/lastName/displayName/mobile/salutation/language/
 * country/state/city/website) are captured in `name`/synthesised on
 * submit so the existing action keys remain untouched. Per-section field
 * markup is delegated to `<*Section />` components in
 * `contacts-form-sections.tsx` to keep this file under the scope cap.
 */

import * as React from 'react';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import {
    addCrmContact,
    updateCrmContact,
} from '@/app/actions/crm.actions';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
    AddressSection,
    LinkedSection,
    NotesTagsSection,
    PersonalSection,
    SocialSection,
} from './contacts-form-sections';

export interface ContactFormPrefill {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    accountId?: string;
    owner?: string;
    source?: string;
    leadSource?: string;
}

interface ContactFormProps {
    mode: 'create' | 'edit';
    /** Existing contact, when mode === 'edit'. */
    initial?: WithId<CrmContact> | null;
    /** Pre-fill from a parent doc (account, lead, etc.). */
    prefill?: ContactFormPrefill | null;
}

type ActionState = { message?: string; error?: string; contactId?: string };

function splitName(full: string | undefined | null): {
    first: string;
    last: string;
} {
    if (!full) return { first: '', last: '' };
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function ContactForm({ mode, initial, prefill }: ContactFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    const [pending, startTransition] = React.useTransition();
    const [dirty, setDirty] = React.useState(false);
    const onDirty = React.useCallback(() => setDirty(true), []);

    /* ─── Personal / display ────────────────────────────────────────── */
    const initialName = initial?.name ?? prefill?.name ?? '';
    const split = splitName(initialName);
    const [firstName, setFirstName] = React.useState<string>(
        prefill?.firstName ?? split.first,
    );
    const [lastName, setLastName] = React.useState<string>(
        prefill?.lastName ?? split.last,
    );
    const [displayName, setDisplayName] = React.useState<string>(initialName);
    const [salutation, setSalutation] = React.useState<string>('');
    const [jobTitle, setJobTitle] = React.useState<string>(
        initial?.jobTitle ?? prefill?.jobTitle ?? '',
    );
    const [language, setLanguage] = React.useState<string>('');
    const [timezone, setTimezone] = React.useState<string>(
        initial?.timezone ?? '',
    );
    const [dob, setDob] = React.useState<Date | undefined>(
        initial?.dateOfBirth ? new Date(initial.dateOfBirth) : undefined,
    );

    /* ─── Linked ───────────────────────────────────────────────────── */
    const [accountId, setAccountId] = React.useState<string>(
        initial?.accountId ? String(initial.accountId) : prefill?.accountId ?? '',
    );
    const [owner, setOwner] = React.useState<string>(
        initial?.owner ?? prefill?.owner ?? '',
    );
    const [status, setStatus] = React.useState<string>(
        (initial?.status as string) ?? 'new_lead',
    );
    const [lifecycle, setLifecycle] = React.useState<string>(
        initial?.lifecycleStage ?? '',
    );
    const [leadSource, setLeadSource] = React.useState<string>(
        initial?.leadSource ?? prefill?.leadSource ?? '',
    );
    const [source, setSource] = React.useState<string>(
        initial?.source ?? prefill?.source ?? '',
    );

    /* ─── Address cascade ──────────────────────────────────────────── */
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    const [country, setCountry] = React.useState<string>(
        anyInitial?.country ?? '',
    );
    const [stateVal, setStateVal] = React.useState<string>(
        anyInitial?.state ?? '',
    );
    const [city, setCity] = React.useState<string>(anyInitial?.city ?? '');

    /* ─── Effective composed name ──────────────────────────────────── */
    const composedName = React.useMemo(() => {
        const dn = displayName.trim();
        if (dn) return dn;
        const composed = [firstName, lastName].filter(Boolean).join(' ').trim();
        if (composed) return composed;
        return initialName;
    }, [firstName, lastName, displayName, initialName]);

    const submit = React.useCallback(
        async (intent: 'save' | 'save_new' | 'save_deal') => {
            if (!formRef.current) return;
            const fd = new FormData(formRef.current);
            // Ensure `name` (action contract) is the effective composed name.
            fd.set('name', composedName);
            // dateOfBirth → ISO if picked.
            if (dob) fd.set('dateOfBirth', dob.toISOString());

            startTransition(async () => {
                const state: ActionState =
                    mode === 'edit'
                        ? await updateCrmContact({}, fd)
                        : await addCrmContact({}, fd);

                if (state.error) {
                    toast({
                        title: 'Could not save',
                        description: state.error,
                        variant: 'destructive',
                    });
                    return;
                }

                setDirty(false);
                toast({
                    title: state.message ?? 'Saved',
                    variant: 'default',
                });

                const newId =
                    state.contactId ??
                    (initial?._id ? String(initial._id) : '');

                if (intent === 'save_new') {
                    router.push('/dashboard/crm/sales-crm/contacts/new');
                    return;
                }
                if (intent === 'save_deal' && newId) {
                    router.push(
                        `/dashboard/crm/sales-crm/deals/new?contactId=${newId}`,
                    );
                    return;
                }
                if (newId) {
                    router.push(`/dashboard/crm/sales-crm/contacts/${newId}`);
                } else {
                    router.push('/dashboard/crm/sales-crm/contacts');
                }
            });
        },
        [mode, initial?._id, composedName, dob, router, toast],
    );

    /* Cmd/Ctrl+S → save. */
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void submit('save');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submit]);

    return (
        <form
            ref={formRef}
            onChange={() => setDirty(true)}
            onSubmit={(e) => {
                e.preventDefault();
                void submit('save');
            }}
            className="flex w-full flex-col gap-6 pb-24"
        >
            <DirtyFormPrompt dirty={dirty && !pending} />

            {/* Hidden helpers — kept inside the form so they ship in FormData
                under the action's expected field-name contract. */}
            {mode === 'edit' && initial?._id ? (
                <input
                    type="hidden"
                    name="contactId"
                    value={String(initial._id)}
                />
            ) : null}
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="owner" value={owner} />
            <input type="hidden" name="source" value={leadSource || source} />
            <input type="hidden" name="lifecycleStage" value={lifecycle} />
            <input type="hidden" name="jobTitle" value={jobTitle} />
            <input type="hidden" name="timezone" value={timezone} />

            <PersonalSection
                initial={initial}
                onDirty={onDirty}
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                salutation={salutation}
                setSalutation={setSalutation}
                displayName={displayName}
                setDisplayName={setDisplayName}
                jobTitle={jobTitle}
                setJobTitle={setJobTitle}
                timezone={timezone}
                setTimezone={setTimezone}
                language={language}
                setLanguage={setLanguage}
                dob={dob}
                setDob={setDob}
                prefillEmail={prefill?.email}
                prefillPhone={prefill?.phone}
            />

            <LinkedSection
                initial={initial}
                onDirty={onDirty}
                accountId={accountId}
                setAccountId={setAccountId}
                owner={owner}
                setOwner={setOwner}
                status={status}
                setStatus={setStatus}
                lifecycle={lifecycle}
                setLifecycle={setLifecycle}
                leadSource={leadSource}
                setLeadSource={setLeadSource}
                source={source}
                setSource={setSource}
                prefillCompany={prefill?.company}
            />

            <AddressSection
                initial={initial}
                onDirty={onDirty}
                country={country}
                setCountry={setCountry}
                stateVal={stateVal}
                setStateVal={setStateVal}
                city={city}
                setCity={setCity}
            />

            <SocialSection initial={initial} onDirty={onDirty} />
            <NotesTagsSection initial={initial} onDirty={onDirty} />

            {/* ─── Sticky action bar ──────────────────────────────────── */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-zoru-line bg-zoru-bg/95 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <ZoruButton
                        type="button"
                        variant="ghost"
                        onClick={() =>
                            router.push('/dashboard/crm/sales-crm/contacts')
                        }
                        disabled={pending}
                    >
                        Cancel
                    </ZoruButton>
                    <ZoruButton
                        type="button"
                        variant="outline"
                        onClick={() => void submit('save_new')}
                        disabled={pending}
                    >
                        Save &amp; New
                    </ZoruButton>
                    <ZoruButton
                        type="button"
                        variant="outline"
                        onClick={() => void submit('save_deal')}
                        disabled={pending}
                        title="Save and create a deal linked to this contact"
                    >
                        Save &amp; Add Deal
                    </ZoruButton>
                    <ZoruButton type="submit" disabled={pending}>
                        {pending ? (
                            <LoaderCircle
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <Save className="h-4 w-4" aria-hidden="true" />
                        )}
                        {mode === 'edit' ? 'Save changes' : 'Save contact'}
                    </ZoruButton>
                </div>
            </div>
        </form>
    );
}

export default ContactForm;
