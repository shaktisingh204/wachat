import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { getSabmonitorStatusPage } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
import { StatusPageForm } from '../../_components/status-page-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ pageId: string }>;
}

export default async function EditStatusPagePage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { pageId } = await params;
    const page = await getSabmonitorStatusPage(pageId);
    if (!page) notFound();
    return (
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>Status page</PageEyebrow>
                    <PageTitle>{page.title}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        className="u-btn u-btn--outline u-btn--md"
                        href={`/uptime/${page.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open public status page for ${page.title} in a new tab`}
                    >
                        <span className="u-btn__label">Open public page</span>
                        <ExternalLink size={14} aria-hidden="true" />
                    </Link>
                </PageActions>
            </PageHeader>
            <StatusPageForm initial={page} />
        </div>
    );
}
