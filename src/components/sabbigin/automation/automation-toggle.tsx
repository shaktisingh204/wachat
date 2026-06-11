'use client';

/**
 * Inline enable/disable switch for a single automation rule, used in the
 * rules-list table. Optimistically flips, then calls
 * `toggleSabbiginAutomation`; reverts + toasts on failure.
 */

import { useState, useTransition } from 'react';

import { Badge, toast } from '@/components/sabcrm/20ui';
import { toggleSabbiginAutomation } from '@/app/actions/sabbigin-automations.actions';

export function AutomationToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  const flip = () => {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await toggleSabbiginAutomation(id, next);
      if (!res.success) {
        setOn(!next);
        toast.error({ title: 'Could not update rule', description: res.error });
      } else {
        toast.success({
          title: next ? 'Rule enabled' : 'Rule paused',
        });
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Disable rule' : 'Enable rule'}
      onClick={flip}
      disabled={pending}
      className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <Badge tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</Badge>
    </button>
  );
}
