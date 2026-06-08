import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { SeoAudit, SeoProject } from '@/lib/seo/definitions';
import { fmtDate } from '@/lib/utils';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
    Card,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { FileWarning } from 'lucide-react';

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
            <div className="20ui flex items-center justify-center h-screen bg-[var(--st-bg)]">
                <EmptyState
                    icon={FileWarning}
                    tone="danger"
                    title="Report unavailable"
                    description="We could not load this audit report, or there is no data to show yet."
                />
            </div>
        );
    }

    // Customizable branding: preference to project settings, fallback to searchParams, then default
    const whiteLabel = project?.settings?.whiteLabel || {};
    const agencyName = (resolvedSearchParams.agencyName as string) || whiteLabel.agencyName || 'Project Titan SEO Platform';
    const logoUrl = (resolvedSearchParams.logoUrl as string) || whiteLabel.logoUrl;
    const primaryColor = (resolvedSearchParams.primaryColor as string) || whiteLabel.primaryColor || '#2563eb';

    const allIssues = (audit.pages || []).flatMap((p) => p.issues?.map((i) => ({ ...i, url: p.url })) || []);
    const topIssues = allIssues.filter((i) => i.severity === 'critical').slice(0, 15);
    const hasPages = Boolean(audit.pages && audit.pages.length > 0);

    return (
        <div className="20ui p-8 bg-[var(--st-bg)] text-[var(--st-text)] max-w-[210mm] mx-auto min-h-screen">
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

            <PageHeader className="mb-8 print-break-inside-avoid">
                <PageHeaderHeading>
                    <PageTitle style={{ color: primaryColor }}>SEO Audit Report</PageTitle>
                    <PageDescription>
                        Project: {project?.domain || projectId}. Date: {fmtDate(audit.createdAt || audit.startedAt || Date.now())}
                    </PageDescription>
                </PageHeaderHeading>
                {logoUrl && (
                    <PageActions>
                        <div className="w-40 h-16 flex items-center justify-end">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoUrl} alt={`${agencyName} logo`} className="max-w-full max-h-full object-contain" />
                        </div>
                    </PageActions>
                )}
            </PageHeader>

            <section className="mb-10 print-break-inside-avoid">
                <h2
                    className="text-xl font-bold mb-5 border-l-4 pl-3 text-[var(--st-text)]"
                    style={{ borderColor: primaryColor }}
                >
                    Executive Summary
                </h2>
                <div className="grid grid-cols-3 gap-6">
                    <StatCard
                        label="Health Score"
                        value={<span style={{ color: primaryColor }}>{audit.totalScore || 85}/100</span>}
                    />
                    <StatCard
                        label="Pages Crawled"
                        value={audit.summary?.totalPages || audit.pages?.length || 0}
                    />
                    <StatCard
                        label="Critical Issues"
                        value={audit.summary?.criticalIssues || 0}
                    />
                </div>
            </section>

            <section className="print-break-inside-avoid">
                <h2 className="text-xl font-bold mb-5 border-l-4 border-[var(--st-border)] pl-3 text-[var(--st-text)]">
                    Top Issues
                </h2>
                <div className="space-y-3">
                    {!hasPages ? (
                        <EmptyState
                            title="No pages crawled"
                            description="There are no crawled pages, so there are no issues to show."
                        />
                    ) : topIssues.length === 0 ? (
                        <EmptyState
                            tone="success"
                            title="No major issues found"
                            description="This site has no critical issues. Great job."
                        />
                    ) : (
                        topIssues.map((issue, i) => (
                            <Card
                                key={i}
                                variant="outlined"
                                padding="md"
                                className="flex flex-col sm:flex-row justify-between items-start sm:items-center print-break-inside-avoid gap-2"
                            >
                                <div className="max-w-[80%] break-all">
                                    <span className="font-medium text-[var(--st-text)] block mb-1">{issue.message}</span>
                                    <a
                                        href={issue.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-[var(--st-text-secondary)] hover:underline"
                                    >
                                        {issue.url}
                                    </a>
                                </div>
                                <Badge tone="danger" kind="soft" className="shrink-0 uppercase tracking-wider">
                                    {issue.severity || 'High'}
                                </Badge>
                            </Card>
                        ))
                    )}
                </div>
            </section>

            <footer className="mt-16 pt-6 border-t border-[var(--st-border)] text-center text-sm text-[var(--st-text-secondary)] font-medium print-break-inside-avoid">
                Report generated by{' '}
                <span className="font-bold" style={{ color: primaryColor }}>{agencyName}</span>
            </footer>
        </div>
    );
}
