'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — Projects route (`/sabcrm/projects`).
 *
 * A full project-management surface (List / Board / Timeline) over the
 * `projects` data-model object. Auth, onboarding, RBAC and project context are
 * enforced by `../layout.tsx` (which wraps every `/sabcrm/*` child in the
 * `.sabcrm-twenty` / `.ui20` frame); the workspace's own server actions re-run
 * the full gate, so the page fails closed to calm in-page states.
 *
 * The `Suspense` boundary satisfies Next's requirement for `useSearchParams`
 * (the active view is read from `?view=`).
 */

import * as React from 'react';

import { ProjectsWorkspace } from './projects-workspace';

export default function ProjectsPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={null}>
      <ProjectsWorkspace />
    </React.Suspense>
  );
}
