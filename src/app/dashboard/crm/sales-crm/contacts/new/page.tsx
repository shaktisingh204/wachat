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
import { useSearchParams } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    ContactForm,
    type ContactFormPrefill,
} from '../_components/contacts-form';

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
        <EntityListShell title="New Contact" subtitle={subtitle}>
            <ContactForm mode="create" prefill={prefill} />
        </EntityListShell>
    );
}
