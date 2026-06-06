import * as React from 'react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

import { CheckForm } from '../../_components/check-form';

export default function NewSabmonitorCheckPage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New check</PageTitle>
                    <PageDescription>
                        Configure an uptime, SSL, or synthetic monitor for SabMonitor.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <CheckForm />
        </div>
    );
}
