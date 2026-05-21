/**
 * Public project rating — `/share/project-rating/[hash]`.
 *
 * Lookup keyed on `crm_projects.publicRatingHash` (separate hash from
 * Gantt/Taskboard so admin can share the rating link independently).
 * If the visitor has already rated (by IP) we show a static "thanks"
 * panel instead of the form.
 */

import { notFound } from 'next/navigation';
import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { getPublicProjectRating } from '@/app/actions/public-project-rating.actions';
import { PublicRatingForm } from './_components/public-rating-form';

type Params = Promise<{ hash: string }>;

export default async function PublicProjectRatingPage({
  params,
}: {
  params: Params;
}) {
  const { hash } = await params;
  const data = await getPublicProjectRating(hash);
  if (!data) notFound();

  const { project, alreadyRated } = data;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ZoruCard>
        <ZoruCardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Project feedback
          </p>
          <ZoruCardTitle className="mt-1">{project.name}</ZoruCardTitle>
          {project.clientName ? (
            <p className="mt-1 text-sm text-zinc-500">
              for {project.clientName}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-zinc-600">
            Please rate your experience working on this project. Your feedback
            helps us improve.
          </p>
        </ZoruCardHeader>
        <ZoruCardContent>
          {alreadyRated ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Thank you!</p>
              <p className="mt-1">
                You&apos;ve already submitted feedback for this project.
              </p>
            </div>
          ) : (
            <PublicRatingForm hash={hash} />
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
