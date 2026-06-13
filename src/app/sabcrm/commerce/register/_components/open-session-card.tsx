'use client';

/**
 * SabCRM Commerce — register zero-open-session CTA (spec WI-22 §5.3).
 *
 * Shown when no POS session is open. Collects the opening cash float
 * (terminal id + opening cash + notes → `openSabcrmPosSession`) and
 * refreshes so the register page re-resolves the now-open session.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Monitor } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
} from '@/components/sabcrm/20ui';

import { openSabcrmPosSession } from '@/app/actions/sabcrm-commerce.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

export interface OpenSessionCardProps {
  error: string | null;
}

export function OpenSessionCard({ error }: OpenSessionCardProps): React.JSX.Element {
  const router = useRouter();
  const [terminalId, setTerminalId] = React.useState('');
  const [openingCash, setOpeningCash] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = (): void => {
    if (!terminalId.trim()) {
      setFormError('A terminal id is required.');
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await openSabcrmPosSession({
        terminalId: terminalId.trim(),
        openingCash: openingCash.trim() ? Number(openingCash) : 0,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      // Re-resolve the now-open session on the server entry.
      router.replace(`/sabcrm/commerce/register?sessionId=${encodeURIComponent(res.data._id)}`);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 pb-12 pt-12">
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Monitor size={16} aria-hidden="true" /> Open a register session
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
            No register session is open. Count the opening cash float to start
            selling.
          </p>
          {error ? (
            <div className="mb-3">
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-3">
              <Field label="Terminal id" required>
                <Input
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  placeholder="till-1"
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <Field label="Opening cash">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  disabled={pending}
                />
              </Field>
              {formError ? (
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              ) : null}
              <Button type="submit" variant="primary" loading={pending} className="w-full">
                Open session
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
