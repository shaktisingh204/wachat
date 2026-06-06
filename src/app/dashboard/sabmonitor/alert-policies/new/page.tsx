import * as React from 'react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

import { AlertPolicyForm } from '../../_components/alert-policy-form';

export default function NewAlertPolicyPage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New alert policy</PageTitle>
                    <PageDescription>
                        Define the checks, conditions, and channels that trigger an alert.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <AlertPolicyForm />
        </div>
    );
}
