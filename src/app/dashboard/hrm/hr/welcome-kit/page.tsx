'use client';

import { Heart } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getWelcomeKits,
  saveWelcomeKit,
  deleteWelcomeKit,
} from '@/app/actions/hr.actions';
import type { HrWelcomeKit } from '@/lib/hr-types';
import { fields } from './_config';

export default function WelcomeKitPage() {
  return (
    <HrEntityPage<HrWelcomeKit & { _id: string }>
      title="Welcome Kits"
      subtitle="Curate swag, docs, and thoughtful first-day items."
      icon={Heart}
      singular="Kit"
      basePath="/dashboard/hrm/hr/welcome-kit"
      getAllAction={getWelcomeKits as any}
      saveAction={saveWelcomeKit}
      deleteAction={deleteWelcomeKit}
      columns={[
        { key: 'name', label: 'Name' },
        {
          key: 'items',
          label: 'Items',
          render: (row) =>
            Array.isArray(row.items) ? String(row.items.length) : '0',
        },
        { key: 'description', label: 'Description' },
      ]}
      fields={fields}
    />
  );
}
