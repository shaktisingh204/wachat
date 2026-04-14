'use client';

import { Heart } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getWelcomeKits,
  saveWelcomeKit,
  deleteWelcomeKit,
} from '@/app/actions/hr.actions';
import type { HrWelcomeKit } from '@/lib/hr-types';

export default function WelcomeKitPage() {
  return (
    <HrEntityPage<HrWelcomeKit & { _id: string }>
      title="Welcome Kits"
      subtitle="Curate swag, docs, and thoughtful first-day items."
      icon={Heart}
      singular="Kit"
      getAllAction={getWelcomeKits as any}
      saveAction={saveWelcomeKit}
      deleteAction={deleteWelcomeKit}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'items',
          label: 'Items (JSON array)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"label":"Welcome card"}]',
        },
      ]}
    />
  );
}
