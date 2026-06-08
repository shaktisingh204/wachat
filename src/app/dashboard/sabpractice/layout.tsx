import * as React from 'react';

import { SabpracticeNav } from './_components/sabpractice-nav';

export const metadata = {
    title: 'SabPractice · SabNode',
    description: 'Accountant practice management. Clients, engagements, deadlines, time.',
};

export default function SabPracticeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="20ui">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
                <SabpracticeNav />
                <main>{children}</main>
            </div>
        </div>
    );
}
