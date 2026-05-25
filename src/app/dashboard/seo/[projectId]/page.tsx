import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ProjectDashboardClient } from './_components/project-dashboard-client';
import { getSeoProject, getSiteMetrics } from '@/app/actions/seo.actions';
import ProjectDashboardLoading from './loading';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Project Dashboard | SabNode',
};

async function ProjectDashboardData({ projectId }: { projectId: string }) {
  const project = await getSeoProject(projectId);
  if (!project) {
    notFound();
  }

  const metrics = await getSiteMetrics(project.domain);

  return (
    <ProjectDashboardClient 
      projectId={projectId} 
      initialProject={project} 
      initialMetrics={metrics} 
    />
  );
}

export default async function ProjectDashboardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  
  return (
    <Suspense fallback={<ProjectDashboardLoading />}>
      <ProjectDashboardData projectId={projectId} />
    </Suspense>
  );
}
