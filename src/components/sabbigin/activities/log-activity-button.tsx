'use client';

/**
 * SabBigin — Log activity button.
 *
 * A self-contained trigger (Button + its own `LogActivityModal` instance) so a
 * SERVER page can drop "Log activity" into its `<PageActions>` without managing
 * any client state itself. On success it refreshes the route so the new
 * activity appears.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

import { LogActivityModal } from './log-activity-modal';
import type { SabbiginActivityType } from '@/app/actions/sabbigin-activities.actions';

export interface LogActivityButtonProps {
  defaultType?: SabbiginActivityType;
  contactId?: string;
  dealId?: string;
  /** Button label (defaults to "Log activity"). */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'ghost';
}

export function LogActivityButton({
  defaultType,
  contactId,
  dealId,
  label = 'Log activity',
  size = 'sm',
  variant = 'primary',
}: LogActivityButtonProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant={variant} size={size} iconLeft={Plus} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <LogActivityModal
        open={open}
        onClose={() => setOpen(false)}
        defaultType={defaultType}
        contactId={contactId}
        dealId={dealId}
        onLogged={() => router.refresh()}
      />
    </>
  );
}

export default LogActivityButton;
