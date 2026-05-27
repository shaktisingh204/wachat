import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSabmonitorStatusPage } from '@/app/actions/sabmonitor.actions';
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
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">{page.title}</h2>
                <Link
                    className="text-[12px] text-zoru-brand hover:underline"
                    href={`/status/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open public page →
                </Link>
            </div>
            <StatusPageForm initial={page} />
        </div>
    );
}
