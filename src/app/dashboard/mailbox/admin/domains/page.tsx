/**
 * Hosted Mail — domain admin.
 *
 * Server component shell: lists owned domains via `listMailDomains`,
 * delegates the create form + verification UI to the client child.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { listMailDomains } from '@/app/actions/mailbox.actions';
import { Button, PageHeader } from '@/components/sabcrm/20ui/compat';

import { DomainsClient } from './domains-client';

export const dynamic = 'force-dynamic';

export default async function MailboxDomainsAdminPage() {
    const domains = await listMailDomains();

    return (
        <div className="zoruui mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <PageHeader
                title="Domains"
                description="Add a domain you own, then point its DNS records at SabNode."
                actions={
                    <Button asChild variant="outline">
                        <Link href="/dashboard/mailbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Link>
                    </Button>
                }
            />
            <DomainsClient initialDomains={domains} />
        </div>
    );
}
