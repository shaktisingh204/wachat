'use client';

/**
 * New notice — §1D.3 bar.
 */

import { NoticesForm } from '../_components/notices-form';

export default function NewNoticePage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NoticesForm mode="new" />
        </div>
    );
}
