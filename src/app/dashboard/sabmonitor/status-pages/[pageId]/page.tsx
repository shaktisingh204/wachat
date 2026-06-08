import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { getSabmonitorStatusPage } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    cn,
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
        <div className="20ui flex flex-col gap-4">
            <PageHeader compact bordered={false}>
                <PageHeaderHeading>
                    <PageTitle>{page.title}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        className={cn('u-btn', 'u-btn--outline', 'u-btn--sm')}
                        href={`/uptime/${page.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open public status page for ${page.title} in a new tab`}
                    >
                        <span className="u-btn__label">Open public page</span>
                        <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                </PageActions>
            </PageHeader>
            <StatusPageForm initial={page} />
        </div>
    );
}
