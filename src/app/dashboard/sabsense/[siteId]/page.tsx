import { redirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ siteId: string }>;
}

export default async function PagesenseSiteRoot({ params }: PageProps) {
    const { siteId } = await params;
    redirect(`/dashboard/pagesense/${siteId}/heatmaps`);
}
