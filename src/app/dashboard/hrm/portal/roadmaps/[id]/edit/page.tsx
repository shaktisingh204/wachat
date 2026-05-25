import * as React from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getRoadmapById } from '@/app/actions/hrm-roadmaps.actions';
import EditRoadmapForm from './edit-roadmap-form';
import { LoaderCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';


export default async function EditRoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        href={`/dashboard/hrm/portal/roadmaps/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Roadmap
      </Link>

      <h1 className="mb-6 text-xl font-semibold text-zoru-ink">Edit Roadmap</h1>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
          </div>
        }
      >
        <RoadmapData id={id} />
      </Suspense>
    </div>
  );
}

async function RoadmapData({ id }: { id: string }) {
  const roadmap = await getRoadmapById(id);
  
  if (!roadmap) {
    notFound();
  }

  // Ensure dates are correctly formatted as strings to avoid hydration mismatches
  const formattedRoadmap = {
    ...roadmap,
    startDate: roadmap.startDate ? new Date(roadmap.startDate).toISOString().slice(0, 10) : '',
    endDate: roadmap.endDate ? new Date(roadmap.endDate).toISOString().slice(0, 10) : '',
    // _id might be an ObjectId, safely stringify it
    _id: roadmap._id?.toString(),
    userId: roadmap.userId?.toString(),
  };

  return <EditRoadmapForm initialRoadmap={formattedRoadmap} id={id} />;
}
