'use client';

import { KbInternalForm } from '../_components/kb-internal-form';

export default function NewKnowledgeBasePage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <KbInternalForm mode="new" />
        </div>
    );
}
