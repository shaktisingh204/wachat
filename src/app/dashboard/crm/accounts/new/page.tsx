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
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href="/dashboard/crm/accounts"
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Accounts
                </Link>
            </div>

            <CrmPageHeader
                title="New Account"
                subtitle={subtitle}
                icon={Building2}
            />

            <AccountForm mode="create" prefill={prefill} />
        </div>
    );
}
