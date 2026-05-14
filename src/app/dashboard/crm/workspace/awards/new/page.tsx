'use client';

import { AwardsForm } from '../_components/awards-form';

export default function NewAwardPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AwardsForm mode="new" />
        </div>
    );
}
