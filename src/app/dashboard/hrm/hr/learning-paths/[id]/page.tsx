export const dynamic = 'force-dynamic';
import { CircleCheck, Circle, Trophy, Award } from 'lucide-react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import {
  getLearningPaths,
  deleteLearningPath,
} from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';

type Step = { title: string; link?: string; type?: string; duration?: string; done?: boolean };
type Row = HrLearningPath & {
  _id: string;
  status?: string;
  category?: string;
  difficulty?: string;
  assigned_to?: string;
  estimatedHours?: number;
  prerequisites?: string;
  outcomes?: string;
  targetRole?: string;
  isPublished?: string;
};

function StepList({ steps }: { steps: Step[] }) {
  if (!steps.length) {
    return <p className="text-sm text-zoru-ink-muted">No steps configured yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
        >
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zoru-surface text-[11px] font-medium text-zoru-ink">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {s.done ? (
                <CircleCheck className="h-4 w-4 text-zoru-success-ink" />
              ) : (
                <Circle className="h-4 w-4 text-zoru-ink-muted" />
              )}
              <span className="truncate text-sm font-medium text-zoru-ink">
                {s.title || '—'}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
              {s.type ?? 'course'}
              {s.duration ? ` · ${s.duration}` : ''}
              {s.link ? (
                <>
                  {' · '}
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-2 hover:underline"
                  >
                    Open
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function LearningPathDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = (await getLearningPaths()) as Row[];
  const row = list.find((r) => String(r._id) === id) ?? null;

  if (!row) return <div className="text-sm text-zoru-ink-muted">Path not found.</div>;

  const steps = (row.steps ?? []) as Step[];

  return (
    <HrDetailPage
      title={row.name || 'Learning path'}
      eyebrow="LEARNING PATH"
      status={{ label: String(row.status ?? 'active') }}
      listHref="/dashboard/hrm/hr/learning-paths"
      listLabel="Back to paths"
      editHref={`/dashboard/hrm/hr/learning-paths/${id}/edit`}
      deleteAction={deleteLearningPath}
      entityId={id}
      sections={[
        {
          title: 'Overview',
          fields: [
            { label: 'Category', value: row.category },
            { label: 'Difficulty', value: row.difficulty },
            { label: 'Target role', value: row.targetRole },
            { label: 'Estimated hours', value: row.estimatedHours },
            { label: 'Assigned to', value: row.assigned_to },
            { label: 'Published', value: row.isPublished === 'yes' ? 'Yes' : 'No' },
            { label: 'Description', value: row.description, fullWidth: true },
            { label: 'Prerequisites', value: row.prerequisites, fullWidth: true },
            { label: 'Outcomes', value: row.outcomes, fullWidth: true },
          ],
        },
        {
          title: 'Gamification Progress',
          fields: [
            {
              label: 'Completion',
              value: (
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    <svg className="h-full w-full" viewBox="0 0 36 36">
                      <path
                        className="text-zoru-line"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="text-zoru-ink transition-all duration-500 ease-in-out"
                        strokeDasharray={`${steps.length > 0 ? (steps.filter(s => s.done).length / steps.length) * 100 : 0}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zoru-ink">
                      {steps.length > 0 ? Math.round((steps.filter(s => s.done).length / steps.length) * 100) : 0}%
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {steps.length > 0 && steps.every(s => s.done) ? (
                      <div className="flex flex-col items-center p-2 border border-zoru-line bg-zoru-surface-2 rounded-md">
                        <Trophy className="h-6 w-6 text-zoru-ink mb-1" />
                        <span className="text-xs font-semibold text-zoru-ink">Mastery Badge</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center p-2 border border-zoru-line bg-zoru-surface-2 rounded-md opacity-50">
                        <Award className="h-6 w-6 text-zoru-ink-muted mb-1" />
                        <span className="text-xs font-semibold text-zoru-ink-muted">Keep Going</span>
                      </div>
                    )}
                  </div>
                </div>
              ),
              fullWidth: true
            }
          ]
        },
        {
          title: `Steps (${steps.length})`,
          fields: [
            {
              label: 'Progress',
              value: <StepList steps={steps} />,
              fullWidth: true,
            },
          ],
        },
      ]}
    />
  );
}
