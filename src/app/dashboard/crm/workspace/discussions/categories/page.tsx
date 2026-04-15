'use client';

import { Folder } from 'lucide-react';
import { HrEntityPage } from '../../../_components/hr-entity-page';
import {
  getDiscussionCategories,
  saveDiscussionCategory,
  deleteDiscussionCategory,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsDiscussionCategory } from '@/lib/worksuite/knowledge-types';

export default function DiscussionCategoriesPage() {
  return (
    <HrEntityPage<WsDiscussionCategory & { _id: string }>
      title="Discussion Categories"
      subtitle="Group discussions by topic."
      icon={Folder}
      singular="Category"
      getAllAction={getDiscussionCategories as any}
      saveAction={saveDiscussionCategory}
      deleteAction={deleteDiscussionCategory}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ name: 'name', label: 'Name', required: true, fullWidth: true }]}
    />
  );
}
