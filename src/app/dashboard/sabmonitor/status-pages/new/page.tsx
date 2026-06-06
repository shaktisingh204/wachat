import * as React from 'react';

import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';

import { StatusPageForm } from '../../_components/status-page-form';

export default function NewStatusPagePage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New status page</PageTitle>
                    <PageDescription>Publish a public page that shows the live health of your monitors.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <StatusPageForm />
        </div>
    );
}
