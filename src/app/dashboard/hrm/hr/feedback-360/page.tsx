'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getFeedback360,
  saveFeedback360,
  deleteFeedback360,
} from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber'> = {
  pending: 'amber',
  submitted: 'green',
};

const TYPE_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'rose-soft'> = {
  self: 'neutral',
  peer: 'blue',
  manager: 'amber',
  'direct-report': 'green',
};

function RatingDots({ value }: { value: unknown }) {
  const n = Math.min(5, Math.max(0, Number(value) || 0));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= n ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-border'}`}
        />
      ))}
    </div>
  );
}

export default function Feedback360Page() {
  return (
    <HrEntityPage<HrFeedback360 & { _id: string }>
      title="360° Feedback"
      subtitle="Peer, manager, direct-report, and self reviews."
      icon={Star}
      singular="Feedback"
      basePath="/dashboard/hrm/hr/feedback-360"
      getAllAction={getFeedback360 as any}
      saveAction={saveFeedback360}
      deleteAction={deleteFeedback360}
      columns={[
        {
          key: 'reviewee_id',
          label: 'Reviewee',
          render: (row) => (
            <span className="block max-w-[140px] truncate">
              {(row as any).reviewee_id || String(row.employeeId) || '—'}
            </span>
          ),
        },
        {
          key: 'reviewer_id',
          label: 'Reviewer',
          render: (row) => (
            <span className="block max-w-[140px] truncate">
              {(row as any).reviewer_id || (row as any).reviewerName || '—'}
            </span>
          ),
        },
        {
          key: 'type',
          label: 'Type',
          render: (row) => {
            const t = (row as any).type || row.reviewerType;
            return t ? (
              <ClayBadge tone={TYPE_TONES[t] || 'neutral'} dot>
                {t}
              </ClayBadge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          key: 'period',
          label: 'Period',
          render: (row) => (row as any).period || (row as any).reviewCycle || '—',
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const s = (row as any).status;
            return s ? (
              <ClayBadge tone={STATUS_TONES[s] || 'neutral'} dot>
                {s}
              </ClayBadge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          key: 'rating_communication',
          label: 'Communication',
          render: (row) => (
            <RatingDots value={(row as any).rating_communication ?? (row as any).rating} />
          ),
        },
      ]}
      fields={fields}
    />
  );
}
