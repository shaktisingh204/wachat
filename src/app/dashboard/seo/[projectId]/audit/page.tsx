import { Suspense } from 'react';
import { AuditPageClient } from './_components/audit-page-client';
import { getAuditHistory } from '@/app/actions/seo.actions';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SEO Audit | SabNode',
};

async function AuditPageData({ projectId }: { projectId: string }) {
  const history = await getAuditHistory(projectId, 2);
  // Need to handle type casting for pages since it comes from db
  const clientHistory = history ? history.map((audit: any) => ({
    ...audit,
    _id: audit._id.toString(),
    projectId: audit.projectId.toString(),
  })) : [];
  
  return <AuditPageClient projectId={projectId} initialHistory={clientHistory} />;
}

export default async function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <AuditPageData projectId={projectId} />
    </Suspense>
  );
}
