import { Suspense } from 'react';
import { getProjects } from '@/app/actions/project.actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import ConnectionsClient from './ConnectionsClient';
import ConnectionsLoading from './loading';
import type { WithId, Project } from '@/lib/definitions';

export const dynamic = 'force-dynamic';

export default async function InstagramConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsLoading />}>
      <ConnectionsDataLoader />
    </Suspense>
  );
}

async function ConnectionsDataLoader() {
  const facebookProjects = await getProjects(undefined, 'facebook');
  
  const projectsWithIg = await Promise.all(
    facebookProjects.map(async (p) => {
      const { instagramAccount } = await getInstagramAccountForPage(p._id.toString());
      return instagramAccount ? { ...p, instagramProfile: instagramAccount } : null;
    }),
  );
  
  const initialProjects = projectsWithIg.filter(Boolean) as (WithId<Project> & { instagramProfile?: any })[];

  return <ConnectionsClient initialProjects={initialProjects} />;
}
