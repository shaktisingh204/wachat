import React from 'react';
import { SabworkerlyNav } from './_components/sabworkerly-nav';

export default function SabworkerlyLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="20ui min-h-full bg-[color:var(--st-bg)]">
            <SabworkerlyNav />
            <main className="px-6 py-6">{children}</main>
        </div>
    );
}
