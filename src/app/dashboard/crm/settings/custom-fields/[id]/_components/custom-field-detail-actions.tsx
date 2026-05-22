'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive,
  ArchiveRestore,
  Star } from 'lucide-react';

/**
 * Client islands for the custom-field detail page action group:
 *   - <CustomFieldFlagToggle /> flips the `required` flag in one click.
 *   - <CustomFieldDetailActions /> archives / restores the field.
 *
 * Kept tiny + self-contained so the detail page (server component) can
 * stay async and pull from the Rust BFF directly.
 */

import {
  archiveCustomField,
  toggleCustomFieldRequired,
} from '@/app/actions/crm-custom-fields.actions';

export function CustomFieldFlagToggle({
  fieldId,
  required,
}: {
  fieldId: string;
  required: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleCustomFieldRequired(fieldId, !required);
          if (res.success) {
            toast({
              title: required ? 'Required disabled' : 'Required enabled',
            });
            router.refresh();
          } else {
            toast({
              title: 'Error',
              description: res.error ?? 'Could not toggle.',
              variant: 'destructive',
            });
          }
        })
      }
    >
      <Star className="mr-2 h-4 w-4" />
      {required ? 'Unset required' : 'Set required'}
    </Button>
  );
}

export function CustomFieldDetailActions({
  fieldId,
  isActive,
}: {
  fieldId: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();
  const archive = isActive;

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await archiveCustomField(fieldId, archive);
          if (res.success) {
            toast({
              title: archive ? 'Field archived' : 'Field restored',
            });
            router.refresh();
          } else {
            toast({
              title: 'Error',
              description: res.error ?? 'Could not change status.',
              variant: 'destructive',
            });
          }
        })
      }
    >
      {archive ? (
        <Archive className="mr-2 h-4 w-4" />
      ) : (
        <ArchiveRestore className="mr-2 h-4 w-4" />
      )}
      {archive ? 'Archive' : 'Restore'}
    </Button>
  );
}
