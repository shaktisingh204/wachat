
'use client';

// This layout is no longer needed as navigation is handled by the main app sidebar.
export default function CallsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6">
            {children}
        </div>
    );
}
