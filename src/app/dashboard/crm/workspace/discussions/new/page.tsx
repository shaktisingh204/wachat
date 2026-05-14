'use client';

import { DiscussionsForm } from '../_components/discussions-form';

export default function NewDiscussionPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <DiscussionsForm mode="new" />
        </div>
    );
}
