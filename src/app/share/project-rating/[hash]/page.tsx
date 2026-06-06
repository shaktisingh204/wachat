/**
 * Public project rating — `/share/project-rating/[hash]`.
 *
 * Lookup keyed on `crm_projects.publicRatingHash` (separate hash from
 * Gantt/Taskboard so admin can share the rating link independently).
 * If the visitor has already rated (by IP) we show a static "thanks"
 * panel instead of the form.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { getPublicProjectRating } from '@/app/actions/public-project-rating.actions';
import { PublicRatingForm } from './_components/public-rating-form';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

async function PublicProjectRatingContainer({ hash }: { hash: string }) {
  const data = await getPublicProjectRating(hash);
  if (!data) notFound();

  const { project, alreadyRated } = data;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text)]">
            Project feedback
          </p>
          <CardTitle className="mt-1">{project.name}</CardTitle>
          {project.clientName ? (
            <p className="mt-1 text-sm text-[var(--st-text)]">
              for {project.clientName}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-[var(--st-text)]">
            Please rate your experience working on this project. Your feedback
            helps us improve.
          </p>
        </CardHeader>
        <CardBody>
          <PublicRatingForm 
            hash={hash}
            alreadyRated={alreadyRated}
            existingRating={data.existingRating}
            syndicationUrls={project.syndicationUrls}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default async function PublicProjectRatingPage({
  params,
}: {
  params: Params;
}) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading rating form...</div>}>
      <PublicProjectRatingContainer hash={hash} />
    </React.Suspense>
  );
}
