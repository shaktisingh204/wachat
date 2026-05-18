'use client';

import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle, ZoruSkeleton } from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';

import { SeoProjectCard } from '@/components/wabasimplify/seo-project-card';
import { BarChart } from 'lucide-react';
import { getSeoProjects } from '@/app/actions/seo.actions';
import { CreateSeoProjectDialog } from '@/components/wabasimplify/seo/create-project-dialog';
import type { SeoProject } from '@/lib/seo/definitions';

export default function SeoProjectsPage() {
    const [projects, setProjects] = useState<SeoProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSeoProjects().then(data => {
            setProjects(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <ZoruSkeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>SEO Projects</ZoruPageTitle>
                        <ZoruPageDescription>
                            Manage your website rankings, audits, and competitors.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <CreateSeoProjectDialog />
            </div>

            {projects.length === 0 ? (
                <ZoruCard className="border-dashed p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-zoru-surface-2 rounded-full flex items-center justify-center mb-4">
                            <BarChart className="h-8 w-8 text-zoru-ink-muted" />
                        </div>
                        <h3 className="text-lg mb-2 text-zoru-ink">No projects yet</h3>
                        <p className="text-zoru-ink-muted mb-6 max-w-md">
                            Start tracking your website&apos;s SEO performance by creating your first project.
                        </p>
                        <CreateSeoProjectDialog />
                    </div>
                </ZoruCard>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project: any) => (
                        <SeoProjectCard key={project._id} project={project} />
                    ))}
                </div>
            )}
        </div>
    );
}
