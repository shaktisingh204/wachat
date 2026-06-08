/**
 * Hosted Mail - domain admin.
 *
 * Server component shell: lists owned domains via `listMailDomains`,
 * delegates the create form + verification UI to the client child.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { listMailDomains } from '@/app/actions/mailbox.actions';
import {
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';

import { DomainsClient } from './domains-client';

export const dynamic = 'force-dynamic';

export default async function MailboxDomainsAdminPage() {
    const domains = await listMailDomains();

    return (
        <div className="20ui mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Domains</PageTitle>
                    <PageDescription>
                        Add a domain you own, then point its DNS records at SabNode.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {/* Navigation stays a real anchor (Button is not a polymorphic
                        wrapper), so the Link carries the canonical 20ui outline-button
                        classes for matching styling. */}
                    <Link
                        href="/dashboard/mailbox"
                        className="u-btn u-btn--outline u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <DomainsClient initialDomains={domains} />
        </div>
    );
}
