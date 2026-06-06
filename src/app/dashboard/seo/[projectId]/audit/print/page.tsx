import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { SeoAudit, SeoProject } from '@/lib/seo/definitions';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PrintAuditPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { projectId } = await params;
    const resolvedSearchParams = await searchParams;
    
    let audit: SeoAudit | null = null;
    let project: any = null;

    try {
        if (ObjectId.isValid(projectId)) {
            const { db } = await connectToDatabase();
            
            project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
            
            audit = await db.collection('seo_audits').findOne(
                { projectId: new ObjectId(projectId) },
                { sort: { startedAt: -1 } }
            ) as unknown as SeoAudit;
        }
    } catch (err) {
        console.error("Error fetching audit data for print:", err);
    }

    if (!audit) {
        return (
            <div className="flex items-center justify-center h-screen bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <p>Error loading report or no data found.</p>
            </div>
        );
    }

    // Customizable branding: preference to project settings, fallback to searchParams, then default
    const whiteLabel = project?.settings?.whiteLabel || {};
    const agencyName = (resolvedSearchParams.agencyName as string) || whiteLabel.agencyName || 'Project Titan SEO Platform';
    const logoUrl = (resolvedSearchParams.logoUrl as string) || whiteLabel.logoUrl;
    const primaryColor = (resolvedSearchParams.primaryColor as string) || whiteLabel.primaryColor || '#2563eb';

    return (
        <div className="p-8 bg-white text-black max-w-[210mm] mx-auto min-h-screen">
            <style>{`
                :root {
                    --brand-color: ${primaryColor};
                }
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
                    <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--brand-color)' }}>SEO Audit Report</h1>
                    <p className="text-[var(--st-text)] font-medium">Project: {project?.domain || projectId}</p>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">Date: {fmtDate(audit.createdAt || audit.startedAt || Date.now())}</p>
                </div>
                {logoUrl && (
                    <div className="w-40 h-16 flex items-center justify-end">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt={`${agencyName} Logo`} className="max-w-full max-h-full object-contain" />
                    </div>
                )}
            </header>

            <section className="mb-10 print-break-inside-avoid">
                <h2 className="text-xl font-bold mb-5 border-l-4 pl-3" style={{ borderColor: 'var(--brand-color)' }}>Executive Summary</h2>
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-[var(--st-bg-muted)] border rounded-lg text-center shadow-sm">
                        <div className="text-4xl font-bold" style={{ color: 'var(--brand-color)' }}>{audit.totalScore || 85}/100</div>
                        <div className="text-sm text-[var(--st-text)] mt-2 font-medium">Health Score</div>
                    </div>
                    <div className="p-6 bg-[var(--st-bg-muted)] border rounded-lg text-center shadow-sm">
                        <div className="text-4xl font-bold text-[var(--st-text)]">{audit.summary?.totalPages || audit.pages?.length || 0}</div>
                        <div className="text-sm text-[var(--st-text)] mt-2 font-medium">Pages Crawled</div>
                    </div>
                    <div className="p-6 bg-[var(--st-bg-muted)] border rounded-lg text-center shadow-sm">
                        <div className="text-4xl font-bold text-[var(--st-text)]">{audit.summary?.criticalIssues || 0}</div>
                        <div className="text-sm text-[var(--st-text)] mt-2 font-medium">Critical Issues</div>
                    </div>
                </div>
            </section>

            <section className="print-break-inside-avoid">
                <h2 className="text-xl font-bold mb-5 border-l-4 border-[var(--st-border)] pl-3">Top Issues</h2>
                <div className="space-y-3">
                    {(!audit.pages || audit.pages.length === 0) ? (
                        <p className="text-[var(--st-text)] italic p-4 bg-[var(--st-bg-muted)] rounded border">No pages found to show issues.</p>
                    ) : (() => {
                        const allIssues = audit.pages.flatMap((p) => p.issues?.map((i) => ({ ...i, url: p.url })) || []);
                        const topIssues = allIssues.filter((i) => i.severity === 'critical').slice(0, 15);
                        
                        if (topIssues.length === 0) {
                            return <p className="text-[var(--st-text)] italic p-4 bg-[var(--st-bg-muted)] rounded border">No major issues found. Great job!</p>;
                        }
                        
                        return topIssues.map((issue, i) => (
                            <div key={i} className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--st-bg-muted)] print-break-inside-avoid gap-2 shadow-sm">
                                <div className="max-w-[80%] break-all">
                                    <span className="font-medium text-[var(--st-text)] block mb-1">{issue.message}</span>
                                    <a href={issue.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--st-text)] hover:underline">{issue.url}</a>
                                </div>
                                <span className="text-xs font-bold px-3 py-1 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-full uppercase tracking-wider shrink-0">{issue.severity || 'High'}</span>
                            </div>
                        ));
                    })()}
                </div>
            </section>

            <footer className="mt-16 pt-6 border-t text-center text-sm text-[var(--st-text)] font-medium print-break-inside-avoid">
                Report generated by <span style={{ color: 'var(--brand-color)', fontWeight: 'bold' }}>{agencyName}</span>
            </footer>
        </div>
    );
}
