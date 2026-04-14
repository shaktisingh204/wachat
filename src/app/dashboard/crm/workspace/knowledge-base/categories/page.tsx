'use client';

import { Folder } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getKnowledgeBaseCategories,
  saveKnowledgeBaseCategory,
  deleteKnowledgeBaseCategory,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsKnowledgeBaseCategory } from '@/lib/worksuite/knowledge-types';

export default function KnowledgeBaseCategoriesPage() {
  return (
    <HrEntityPage<WsKnowledgeBaseCategory & { _id: string }>
      title="KB Categories"
      subtitle="Organise knowledge base articles by category."
      icon={Folder}
      singular="Category"
      getAllAction={getKnowledgeBaseCategories as any}
      saveAction={saveKnowledgeBaseCategory}
      deleteAction={deleteKnowledgeBaseCategory}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
      ]}
    />
  );
}
