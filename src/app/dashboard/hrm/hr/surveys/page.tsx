'use client';

import { Gauge } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getSurveys,
  saveSurvey,
  deleteSurvey,
} from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'red'> = {
  draft: 'neutral',
  active: 'green',
  closed: 'red',
};

export default function SurveysPage() {
  return (
    <HrEntityPage<HrSurvey & { _id: string }>
      title="Surveys"
      subtitle="Employee engagement and pulse surveys."
      icon={Gauge}
      singular="Survey"
      basePath="/dashboard/hrm/hr/surveys"
      getAllAction={getSurveys as any}
      saveAction={saveSurvey}
      deleteAction={deleteSurvey}
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
        { key: 'responsesCount', label: 'Responses' },
      ]}
      fields={fields}
    />
  );
}
