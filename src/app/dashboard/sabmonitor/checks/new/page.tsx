import * as React from 'react';

import { CheckForm } from '../../_components/check-form';

export default function NewSabmonitorCheckPage(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zoru-ink">New check</h2>
            <CheckForm />
        </div>
    );
}
