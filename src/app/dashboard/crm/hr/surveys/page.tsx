'use client';

import { Gauge } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getSurveys,
  saveSurvey,
  deleteSurvey,
} from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'red'> = {
  draft: 'neutral',
  open: 'green',
  closed: 'red',
};

export default function SurveysPage() {
  return (
    <HrEntityPage<HrSurvey & { _id: string }>
      title="Surveys"
      subtitle="Employee engagement and pulse surveys."
      icon={Gauge}
      singular="Survey"
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
      fields={[
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ],
          defaultValue: 'draft',
        },
        { name: 'responsesCount', label: 'Responses', type: 'number' },
        {
          name: 'questions',
          label: 'Questions (JSON)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"prompt":"How is morale?","type":"rating"}]',
        },
      ]}
    />
  );
}
