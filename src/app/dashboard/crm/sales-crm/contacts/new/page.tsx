'use client';

/**
 * `/dashboard/crm/sales-crm/contacts/new` — create form.
 *
 * Pre-fills from `?accountId=…`, `?leadId=…` or `?fromKind=&fromId=`
 * query params. Light pre-fill happens here from explicit `?name=`,
 * `?email=`, `?phone=`, `?company=` overrides; deeper hydration from
 * lineage references is deferred to a follow-up.
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
    ContactForm,
    type ContactFormPrefill,
} from '../_components/contacts-form';

export const dynamic = 'force-dynamic';

export default function NewContactPage() {
    const params = useSearchParams();
    const accountId = params.get('accountId') ?? '';
    const leadId = params.get('leadId') ?? '';
    const fromKind = params.get('fromKind') ?? '';
    const fromId = params.get('fromId') ?? '';

    const prefillName = params.get('name');
    const prefillFirstName = params.get('firstName');
    const prefillLastName = params.get('lastName');
    const prefillEmail = params.get('email');
    const prefillPhone = params.get('phone');
    const prefillCompany = params.get('company');
    const prefillJobTitle = params.get('jobTitle');
    const prefillOwner = params.get('owner');
    const prefillSource = params.get('source');

    const prefill: ContactFormPrefill | null =
        prefillName ||
        prefillFirstName ||
        prefillLastName ||
        prefillEmail ||
        prefillPhone ||
        prefillCompany ||
        prefillJobTitle ||
        prefillOwner ||
        prefillSource ||
        accountId
            ? {
                  name: prefillName ?? undefined,
                  firstName: prefillFirstName ?? undefined,
                  lastName: prefillLastName ?? undefined,
                  email: prefillEmail ?? undefined,
                  phone: prefillPhone ?? undefined,
                  company: prefillCompany ?? undefined,
                  jobTitle: prefillJobTitle ?? undefined,
                  accountId: accountId || undefined,
                  owner: prefillOwner ?? undefined,
                  source: prefillSource ?? undefined,
              }
            : null;

    const subtitle =
        fromKind && fromId
            ? `Creating from ${fromKind} ${fromId.slice(-6)}`
            : accountId
              ? 'Linking a new contact to the selected account.'
              : leadId
                ? 'Capturing the contact behind a converted lead.'
                : 'Add a person to your CRM contact book.';

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href="/dashboard/crm/sales-crm/contacts"
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Contacts
                </Link>
            </div>

            <CrmPageHeader
                title="New Contact"
                subtitle={subtitle}
                icon={UserPlus}
            />

            <ContactForm mode="create" prefill={prefill} />
        </div>
    );
}
