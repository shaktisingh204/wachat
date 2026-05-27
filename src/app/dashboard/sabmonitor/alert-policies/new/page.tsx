import * as React from 'react';

import { AlertPolicyForm } from '../../_components/alert-policy-form';

export default function NewAlertPolicyPage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zoru-ink">New alert policy</h2>
            <AlertPolicyForm />
        </div>
    );
}
