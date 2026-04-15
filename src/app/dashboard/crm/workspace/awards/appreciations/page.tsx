'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';
import { HrEntityPage, ClayBadge } from '../../../_components/hr-entity-page';
import {
  getAppreciations,
  saveAppreciation,
  deleteAppreciation,
  getAwards,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsAppreciation,
  WsAward,
} from '@/lib/worksuite/knowledge-types';

function fmt(v: unknown) {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

export default function AppreciationsPage() {
  const [awards, setAwards] = React.useState<(WsAward & { _id: string })[]>([]);

  React.useEffect(() => {
    getAwards().then((a) => setAwards(a as any));
  }, []);

  const awardOptions = awards.map((a) => ({ value: a._id, label: a.title }));

  return (
    <HrEntityPage<WsAppreciation & { _id: string }>
      title="Appreciations"
      subtitle="Recognitions given to team members."
      icon={Heart}
      singular="Appreciation"
      getAllAction={getAppreciations as any}
      saveAction={saveAppreciation}
      deleteAction={deleteAppreciation}
      columns={[
        {
          key: 'award_id',
          label: 'Award',
          render: (row) => {
            const a = awards.find((x) => x._id === row.award_id);
            return <ClayBadge tone="amber">{a?.title || '—'}</ClayBadge>;
          },
        },
        { key: 'given_to_user_name', label: 'Given to', render: (r) => r.given_to_user_name || r.given_to_user_id },
        { key: 'given_by_user_name', label: 'Given by', render: (r) => r.given_by_user_name || r.given_by_user_id },
        {
          key: 'given_on',
          label: 'Given on',
          render: (row) => <span>{fmt(row.given_on)}</span>,
        },
      ]}
      fields={[
        {
          name: 'award_id',
          label: 'Award',
          type: 'select',
          options: awardOptions,
          required: true,
        },
        { name: 'given_to_user_id', label: 'Given to (user id)', required: true },
        { name: 'given_to_user_name', label: 'Given to (name)' },
        { name: 'given_by_user_id', label: 'Given by (user id)', required: true },
        { name: 'given_by_user_name', label: 'Given by (name)' },
        { name: 'given_on', label: 'Given on', type: 'date', required: true },
        { name: 'summary', label: 'Summary', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
