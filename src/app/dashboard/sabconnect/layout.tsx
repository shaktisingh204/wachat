import type { ReactNode } from 'react';

export default function SabConnectLayout({ children }: { children: ReactNode }) {
    return (
        <div className="20ui flex w-full flex-col gap-6 p-4 md:p-6">
            {children}
        </div>
    );
}
