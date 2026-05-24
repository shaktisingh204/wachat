import { cookies, headers } from 'next/headers';

export default async function PrintAuditPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { projectId } = await params;
    const resolvedSearchParams = await searchParams;
    
    // Customizable branding
    const agencyName = (resolvedSearchParams.agencyName as string) || 'Project Titan SEO Platform';
    const logoUrl = resolvedSearchParams.logoUrl as string;

    const cookieStore = await cookies();
    // Dynamically retrieve auth token from cookies instead of hardcoding 'test'
    const token = cookieStore.get('next-auth.session-token')?.value || cookieStore.get('token')?.value || cookieStore.get('session')?.value || 'test';
    
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const res = await fetch(`${protocol}://${host}/api/v1/seo/audit?projectId=${projectId}`, {
        headers: {
            'Cookie': cookieStore.toString(),
            'Authorization': `Bearer ${token}`
        },
        cache: 'no-store' // ensures we get fresh data
    });

    const audit = res.ok ? await res.json() : null;

    if (!audit) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
                <p>Error loading report or no data found.</p>
            </div>
        );
    }

    return (
        <div className="p-8 bg-white text-black max-w-[210mm] mx-auto min-h-screen">
            <style>{`
                @media print {
                    @page { margin: 15mm; }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .print-break-inside-avoid { break-inside: avoid; }
                }
            `}</style>

            <header className="border-b pb-6 mb-8 flex justify-between items-start print-break-inside-avoid">
                <div>
                    <h1 className="text-3xl font-bold mb-2">SEO Audit Report</h1>
                    <p className="text-gray-500">Project: {projectId}</p>
                    <p className="text-sm text-gray-400 mt-1">Date: {new Date().toLocaleDateString()}</p>
                </div>
                {logoUrl && (
                    <div className="w-40 h-16 flex items-center justify-end">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt={`${agencyName} Logo`} className="max-w-full max-h-full object-contain" />
                    </div>
                )}
            </header>

            <section className="mb-10 print-break-inside-avoid">
                <h2 className="text-xl font-bold mb-5 border-l-4 border-blue-600 pl-3">Executive Summary</h2>
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-gray-50 border rounded-lg text-center">
                        <div className="text-4xl font-bold text-blue-700">{audit.score || 85}/100</div>
                        <div className="text-sm text-gray-600 mt-2 font-medium">Health Score</div>
                    </div>
                    <div className="p-6 bg-gray-50 border rounded-lg text-center">
                        <div className="text-4xl font-bold text-gray-800">{audit.urlCount || 0}</div>
                        <div className="text-sm text-gray-600 mt-2 font-medium">Pages Crawled</div>
                    </div>
                    <div className="p-6 bg-gray-50 border rounded-lg text-center">
                        <div className="text-4xl font-bold text-red-600">{audit.issues?.length || 0}</div>
                        <div className="text-sm text-gray-600 mt-2 font-medium">Critical Issues</div>
                    </div>
                </div>
            </section>

            <section className="print-break-inside-avoid">
                <h2 className="text-xl font-bold mb-5 border-l-4 border-red-600 pl-3">Top Issues</h2>
                <div className="space-y-3">
                    {(audit.issues || []).length === 0 ? (
                        <p className="text-gray-600 italic p-4 bg-gray-50 rounded border">No major issues found. Great job!</p>
                    ) : (
                        (audit.issues || []).map((issue: any, i: number) => (
                            <div key={i} className="p-4 border rounded-lg flex justify-between items-center bg-gray-50 print-break-inside-avoid">
                                <span className="font-medium text-gray-800">{issue.message}</span>
                                <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-700 rounded-full uppercase tracking-wider">{issue.severity || 'High'}</span>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <footer className="mt-16 pt-6 border-t text-center text-sm text-gray-500 font-medium print-break-inside-avoid">
                Generated by {agencyName}
            </footer>
        </div>
    );
}
