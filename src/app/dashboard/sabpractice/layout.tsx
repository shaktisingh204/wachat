import * as React from 'react';

import { SabpracticeNav } from './_components/sabpractice-nav';

export const metadata = {
    title: 'SabPractice · SabNode',
    description: 'Accountant practice management — clients, engagements, deadlines, time.',
};

export default function SabPracticeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="zoruui mx-auto w-full max-w-7xl px-4 py-6">
            <SabpracticeNav />
            {children}
        </div>
    );
}
