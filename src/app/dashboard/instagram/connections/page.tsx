import { Suspense } from 'react';
import { getProjects } from '@/app/actions/project.actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import ConnectionsClient from './ConnectionsClient';
import type { WithId, Project } from '@/lib/definitions';
import { LoaderCircle } from 'lucide-react';

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

function ConnectionsLoading() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
    </div>
  );
}
