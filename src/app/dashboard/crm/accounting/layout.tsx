
'use client';

// This secondary layout is no longer needed as navigation is handled by the main CRM layout.
export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            {children}
        </div>
    );
}
