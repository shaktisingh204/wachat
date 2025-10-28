
'use client';

export default function SalesCrmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold font-headline">Sales CRM</h1>
                <p className="text-muted-foreground">Tools to manage your leads, pipelines, and sales performance.</p>
            </div>
            <div className="mt-4 flex-1">
                 {children}
            </div>
        </div>
    );
}
