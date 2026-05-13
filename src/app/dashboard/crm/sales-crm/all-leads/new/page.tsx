'use client';

/**
 * `/dashboard/crm/sales-crm/all-leads/new` — create form.
 *
 * Pre-fills from `?fromKind=&fromId=` query when present (lightweight
 * shape — title/company/email pulled from the route via best-effort
 * lookup; expanded data hydration is handled inside the action that
 * actually consumes the parent doc).
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { LeadForm } from '../_components/leads-form';
import type { CrmLead } from '@/lib/definitions';

export default function NewLeadPage() {
    const params = useSearchParams();
    const fromKind = params.get('fromKind') ?? '';
    const fromId = params.get('fromId') ?? '';
    const prefillTitle = params.get('title');
    const prefillContact = params.get('contactName');
    const prefillEmail = params.get('email');
    const prefillCompany = params.get('company');

    // Read query-string overrides for quick pre-fill. Server-side hydration
    // from `fromKind/fromId` is deferred to a follow-up — keep the hook so
    // the URL contract is stable.
    const prefill: Partial<CrmLead> | null =
        prefillTitle || prefillContact || prefillEmail || prefillCompany
            ? {
                  title: prefillTitle ?? undefined,
                  contactName: prefillContact ?? undefined,
                  email: prefillEmail ?? undefined,
                  company: prefillCompany ?? undefined,
              }
            : null;

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href="/dashboard/crm/sales-crm/all-leads"
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to All Leads
                </Link>
            </div>

            <CrmPageHeader
                title="New Lead"
                subtitle={
                    fromKind && fromId
                        ? `Creating from ${fromKind} ${fromId.slice(-6)}`
                        : 'Capture a new prospect for your sales pipeline.'
                }
                icon={UserPlus}
            />

            <LeadForm mode="create" prefill={prefill} showConvert />
        </div>
    );
}
