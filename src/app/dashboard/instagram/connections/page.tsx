'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from '@/app/actions/project.actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import type { WithId,
  Project } from '@/lib/definitions';

import { InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { ArrowRight, Wrench } from 'lucide-react';
import Link from 'next/link';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

function InstagramAccountCard({
  project,
  onSelect,
}: {
  project: WithId<Project> & { instagramProfile?: any };
  onSelect: () => void;
}) {
  const { instagramProfile } = project;

  return (
    <Card className="flex flex-col p-0">
      <ZoruCardHeader className="flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <ZoruAvatarImage
            src={instagramProfile?.profile_picture_url}
            alt={instagramProfile?.username}
          />
          <ZoruAvatarFallback>
            <InstagramIcon className="h-6 w-6" />
          </ZoruAvatarFallback>
        </Avatar>
        <div>
          <ZoruCardTitle>{instagramProfile?.username || project.name}</ZoruCardTitle>
          <ZoruCardDescription>IG User ID: {instagramProfile?.id}</ZoruCardDescription>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="flex-grow">
        <p className="text-sm text-zoru-ink-muted">
          Followers: {instagramProfile?.followers_count?.toLocaleString() || 'N/A'}
        </p>
        <p className="text-sm text-zoru-ink-muted">
          Media Count: {instagramProfile?.media_count?.toLocaleString() || 'N/A'}
        </p>
      </ZoruCardContent>
      <ZoruCardFooter>
        <Button onClick={onSelect} block>
          Manage Account <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </ZoruCardFooter>
    </Card>
  );
}

export default function InstagramConnectionsPage() {
  const [projects, setProjects] = useState<
    (WithId<Project> & { instagramProfile?: any })[]
  >([]);
  const [isLoading, startLoading] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startLoading(async () => {
      const facebookProjects = await getProjects(undefined, 'facebook');
      const projectsWithIg = await Promise.all(
        facebookProjects.map(async (p) => {
          const { instagramAccount } = await getInstagramAccountForPage(p._id.toString());
          return instagramAccount ? { ...p, instagramProfile: instagramAccount } : null;
        }),
      );
      setProjects(projectsWithIg.filter(Boolean) as any);
    });
  }, []);

  const handleSelectProject = (project: WithId<Project>) => {
    localStorage.setItem('activeProjectId', project._id.toString());
    localStorage.setItem(
      'activeProjectName',
      (project as any).instagramProfile?.username || project.name,
    );
    router.push('/dashboard/instagram');
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <InstagramIcon className="h-7 w-7" />
              Instagram Connections
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Select an Instagram Business Account to manage.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <InstagramAccountCard
              key={p._id.toString()}
              project={p}
              onSelect={() => handleSelectProject(p)}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 p-6">
          <ZoruCardContent className="space-y-4">
            <p className="text-lg text-zoru-ink">No Instagram Accounts Found</p>
            <p className="text-zoru-ink-muted max-w-md mx-auto">
              We couldn&apos;t find any Instagram Business Accounts linked to your connected
              Facebook Pages. Please ensure they are properly connected in your Meta Business
              Suite.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/instagram/setup">
                <Wrench className="mr-2 h-4 w-4" />
                Go to Setup
              </Link>
            </Button>
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
