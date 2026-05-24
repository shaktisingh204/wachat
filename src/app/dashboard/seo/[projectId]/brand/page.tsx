import { BrandDashboardClient } from './brand-client';

export default async function BrandPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    return <BrandDashboardClient projectId={projectId} />;
}

