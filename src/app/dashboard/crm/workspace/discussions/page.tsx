'use client';

import { MessagesSquare, Folder } from 'lucide-react';
import Link from 'next/link';

import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import { ClayButton } from '@/components/clay';
import {
  getDiscussions,
  getDiscussionCategories,
  saveDiscussion,
  deleteDiscussion,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsDiscussion,
  WsDiscussionCategory,
} from '@/lib/worksuite/knowledge-types';
import * as React from 'react';

export default function DiscussionsPage() {
  const [categories, setCategories] = React.useState<
    (WsDiscussionCategory & { _id: string })[]
  >([]);

  React.useEffect(() => {
    getDiscussionCategories().then((c) => setCategories(c as any));
  }, []);

  const catOptions = categories.map((c) => ({ value: c._id, label: c.name }));

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex justify-end">
        <Link href="/dashboard/crm/workspace/discussions/categories">
          <ClayButton variant="pill" leading={<Folder className="h-4 w-4" strokeWidth={1.75} />}>
            Manage Categories
          </ClayButton>
        </Link>
      </div>
      <HrEntityPage<WsDiscussion & { _id: string }>
        title="Discussions"
        subtitle="Team conversations with threaded replies."
        icon={MessagesSquare}
        singular="Discussion"
        getAllAction={getDiscussions as any}
        saveAction={saveDiscussion}
        deleteAction={deleteDiscussion}
        columns={[
          {
            key: 'title',
            label: 'Title',
            render: (row) => (
              <Link
                href={`/dashboard/crm/workspace/discussions/${row._id}`}
                className="font-medium text-clay-ink hover:underline"
              >
                {row.title}
              </Link>
            ),
          },
          {
            key: 'category_id',
            label: 'Category',
            render: (row) => {
              const c = categories.find((x) => x._id === row.category_id);
              return <ClayBadge tone="rose-soft">{c?.name || '—'}</ClayBadge>;
            },
          },
        ]}
        fields={[
          { name: 'title', label: 'Title', required: true, fullWidth: true },
          { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
          {
            name: 'category_id',
            label: 'Category',
            type: 'select',
            options: catOptions,
          },
        ]}
      />
    </div>
  );
}
