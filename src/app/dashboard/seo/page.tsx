import { Suspense } from 'react';
import { SeoProjectsClient } from './_components/seo-projects-client';
import { getSeoProjects } from '@/app/actions/seo.actions';
import SeoProjectsLoading from './loading';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SEO Projects | SabNode',
};

async function SeoProjectsData() {
  const projects = await getSeoProjects();
  return <SeoProjectsClient initialProjects={projects} />;
}

export default function SeoProjectsPage() {
  return (
    <Suspense fallback={<SeoProjectsLoading />}>
      <SeoProjectsData />
    </Suspense>
  );
}
