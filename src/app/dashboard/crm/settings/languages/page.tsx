'use client';

import { useTransition } from 'react';
import { Languages, Star } from 'lucide-react';

import { ClayBadge } from '@/components/clay';
import { HrEntityPage } from '../../_components/hr-entity-page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getLanguages,
  saveLanguage,
  deleteLanguage,
  setDefaultLanguage,
} from '@/app/actions/worksuite/company.actions';
import type { WsLanguageSetting } from '@/lib/worksuite/company-types';

function SetDefaultButton({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  if (isDefault) {
    return (
      <ClayBadge tone="green" dot>
        Default
      </ClayBadge>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setDefaultLanguage(id);
          if (r.success) toast({ title: 'Default language updated.' });
          else
            toast({
              title: 'Error',
              description: r.error,
              variant: 'destructive',
            });
        })
      }
      className="text-[12px] text-muted-foreground"
    >
      <Star className="mr-1 h-3.5 w-3.5" /> Set default
    </Button>
  );
}

export default function LanguagesPage() {
  return (
    <HrEntityPage<WsLanguageSetting & { _id: string }>
      title="Languages"
      subtitle="Enable languages available for users across the workspace."
      icon={Languages}
      singular="Language"
      getAllAction={getLanguages as any}
      saveAction={saveLanguage}
      deleteAction={deleteLanguage}
      columns={[
        { key: 'language_code', label: 'Code' },
        { key: 'language_name', label: 'Name' },
        {
          key: 'is_enabled',
          label: 'Enabled',
          render: (row) => (
            <ClayBadge tone={row.is_enabled ? 'green' : 'neutral'}>
              {row.is_enabled ? 'Yes' : 'No'}
            </ClayBadge>
          ),
        },
        {
          key: 'is_default',
          label: 'Default',
          render: (row) => (
            <SetDefaultButton
              id={String(row._id)}
              isDefault={Boolean(row.is_default)}
            />
          ),
        },
      ]}
      fields={[
        {
          name: 'language_code',
          label: 'Language Code (ISO)',
          required: true,
          placeholder: 'en',
        },
        {
          name: 'language_name',
          label: 'Language Name',
          required: true,
          placeholder: 'English',
        },
        {
          name: 'is_enabled',
          label: 'Enabled',
          type: 'select',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
          defaultValue: 'yes',
        },
        {
          name: 'is_default',
          label: 'Set as Default',
          type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
          defaultValue: 'no',
        },
      ]}
    />
  );
}
