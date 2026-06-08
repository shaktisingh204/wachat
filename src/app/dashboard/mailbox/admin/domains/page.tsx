/**
 * Hosted Mail - domain admin.
 *
 * Server component shell: lists owned domains via `listMailDomains`,
 * delegates the create form + verification UI to the client child.
 */

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

import { listMailDomains } from '@/app/actions/mailbox.actions';
import {
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';

import { DomainsClient } from './domains-client';

export const dynamic = 'force-dynamic';

export default async function MailboxDomainsAdminPage() {
    const domains = await listMailDomains();
    const verified = domains.filter((d) => d.mxStatus === 'verified').length;
    const pending = domains.length - verified;

    return (
        <div className="20ui mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Mailbox admin</PageEyebrow>
                    <PageTitle>Domains</PageTitle>
                    <PageDescription>
                        Add a domain you own, then point its DNS records at SabNode.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {/* Navigation stays a real anchor (Button renders a <button>),
                        so the Link carries the canonical 20ui outline-button classes. */}
                    <Link
                        href="/dashboard/mailbox"
                        className="u-btn u-btn--outline u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to mailbox</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {domains.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Domains"
                        value={String(domains.length)}
                        icon={ShieldCheck}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Verified"
                        value={String(verified)}
                        icon={CheckCircle2}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Pending"
                        value={String(pending)}
                        icon={Clock}
                        accent="#b8730a"
                    />
                </div>
            ) : null}

            <DomainsClient initialDomains={domains} />
        </div>
    );
}
