'use client';

/**
 * `/dashboard/crm/accounts/new` — create form (§1D.3).
 *
 * Pre-fills from `?name=…&industry=…&website=…&phone=…&country=…&
 * state=…&city=…&currency=…&category=…&fromKind=…&fromId=…`. Deeper
 * hydration from a `fromKind/fromId` parent lookup is deferred to a
 * follow-up.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
    AccountForm,
    type AccountFormPrefill,
} from '../_components/accounts-form';

export const dynamic = 'force-dynamic';

export default function NewAccountPage() {
    const params = useSearchParams();

    const fromKind = params.get('fromKind') ?? '';
    const fromId = params.get('fromId') ?? '';

    const prefillName = params.get('name');
    const prefillIndustry = params.get('industry');
    const prefillWebsite = params.get('website');
    const prefillPhone = params.get('phone');
    const prefillCountry = params.get('country');
    const prefillState = params.get('state');
    const prefillCity = params.get('city');
    const prefillCurrency = params.get('currency');
    const prefillCategory = params.get('category');

    const prefill: AccountFormPrefill | null =
        prefillName ||
        prefillIndustry ||
        prefillWebsite ||
        prefillPhone ||
        prefillCountry ||
        prefillState ||
        prefillCity ||
        prefillCurrency ||
        prefillCategory
            ? {
                  name: prefillName ?? undefined,
                  industry: prefillIndustry ?? undefined,
                  website: prefillWebsite ?? undefined,
                  phone: prefillPhone ?? undefined,
                  country: prefillCountry ?? undefined,
                  state: prefillState ?? undefined,
                  city: prefillCity ?? undefined,
                  currency: prefillCurrency ?? undefined,
                  category: prefillCategory ?? undefined,
              }
            : null;

    const subtitle =
        fromKind && fromId
            ? `Creating from ${fromKind} ${fromId.slice(-6)}`
            : 'Add a company to your CRM. Contacts, deals, quotes and invoices will hang off this record.';

    return (
        <EntityDetailShell
            eyebrow="ACCOUNT"
            title="New Account"
            back={{ href: '/dashboard/crm/accounts', label: 'Accounts' }}
        >
            <AccountForm mode="create" prefill={prefill} />
        </EntityDetailShell>
    );
}
