import * as React from 'react';

import { StatusPageForm } from '../../_components/status-page-form';

export default function NewStatusPagePage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[var(--st-text)]">New status page</h2>
            <StatusPageForm />
        </div>
    );
}
