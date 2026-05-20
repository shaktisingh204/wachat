import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';

import { getRoadmapById } from '@/app/actions/hrm-roadmaps.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { RoadmapEditor } from './_components/roadmap-editor';
import type { DirectReport } from './_components/add-task-drawer';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getDirectReports(userId: string): Promise<DirectReport[]> {
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_employees')
      .find(
        { userId: new ObjectId(userId), status: 'Active' },
        { projection: { _id: 1, firstName: 1, lastName: 1, name: 1 } },
      )
      .limit(200)
      .toArray();

    return docs.map((d) => ({
      _id: String(d._id),
      name:
        (d.name as string | undefined)?.trim() ||
        `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() ||
        'Unknown',
    }));
  } catch {
    return [];
  }
}

export default async function RoadmapEditorPage({ params }: PageProps) {
  const { id } = await params;

  const [session, roadmap] = await Promise.all([
    getSession(),
    getRoadmapById(id),
  ]);

  if (!session?.user || !roadmap) notFound();

  const directReports = await getDirectReports(session.user._id);

  return (
    <div className="h-full">
      <RoadmapEditor roadmap={roadmap} directReports={directReports} />
    </div>
  );
}
