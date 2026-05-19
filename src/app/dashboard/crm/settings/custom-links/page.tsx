'use client';

import { ZoruBadge } from '@/components/zoruui';
import {
  Link2 } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';

import {
  getCustomLinks,
  saveCustomLink,
  deleteCustomLink,
} from '@/app/actions/worksuite/meta.actions';
import type { WsCustomLinkSetting } from '@/lib/worksuite/meta-types';

/** Custom sidebar / dashboard links. */
export default function CustomLinksPage() {
  return (
    <HrEntityPage<WsCustomLinkSetting & { _id: string }>
      title="Custom Links"
      subtitle="Extra links rendered in the workspace sidebar."
      icon={Link2}
      singular="Link"
      getAllAction={getCustomLinks as any}
      saveAction={saveCustomLink}
      deleteAction={deleteCustomLink}
      rowOpensEditDialog
      columns={[
        { key: 'link_name', label: 'Name' },
        { key: 'url', label: 'URL' },
        {
          key: 'open_in_new_tab',
          label: 'New tab',
          render: (row) => (
            <ZoruBadge variant={row.open_in_new_tab ? 'warning' : 'ghost'}>
              {row.open_in_new_tab ? 'Yes' : 'No'}
            </ZoruBadge>
          ),
        },
        { key: 'position', label: 'Order' },
      ]}
      fields={[
        { name: 'link_name', label: 'Name', required: true },
        {
          name: 'url',
          label: 'URL',
          required: true,
          type: 'url',
          fullWidth: true,
          placeholder: 'https://example.com',
        },
        {
          name: 'open_in_new_tab',
          label: 'Open in new tab',
          type: 'select',
          options: [
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ],
          defaultValue: 'false',
        },
        { name: 'position', label: 'Order', type: 'number', defaultValue: '0' },
      ]}
    />
  );
}
