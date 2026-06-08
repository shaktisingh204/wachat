'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowLeft, PhoneCall, Video } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  RadioCard,
  RadioCardGroup,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { createSablensSession } from '@/app/actions/sablens.actions';
import type { SablensSessionMode } from '@/lib/rust-client/sablens-sessions';

export function NewSessionForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mode, setMode] = useState<SablensSessionMode>('live_call');
  const [notes, setNotes] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSablensSession({
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        mode,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        toast({ title: 'Could not create session', description: res.error, tone: 'danger' });
        return;
      }
      toast({
        title: 'Session created',
        description: 'Share the customer link from the session console.',
        tone: 'success',
      });
      router.push(`/dashboard/sablens/${res.data._id}`);
    });
  }

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageEyebrow>SabLens</PageEyebrow>
          <PageTitle>New session</PageTitle>
          <PageDescription>
            Create a session, then send the customer their unique join link. The
            link expires when the session ends.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card variant="outlined">
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>Session details</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Customer name">
                <Input
                  placeholder="Mrs. Patel"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Field>
              <Field label="Customer email">
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--st-text)]">
                Session mode
              </span>
              <RadioCardGroup
                label="Session mode"
                value={mode}
                onChange={(v) => setMode(v as SablensSessionMode)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <RadioCard
                  value="live_call"
                  label="Live call"
                  description="Both ends connected in real time."
                  icon={PhoneCall}
                />
                <RadioCard
                  value="async_recorded"
                  label="Async recorded"
                  description="Customer captures, you review later."
                  icon={Video}
                />
              </RadioCardGroup>
            </div>

            <Field label="Notes" help="Issue summary, equipment, or prep notes.">
              <Textarea
                placeholder="What does the customer need help with?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button asChild type="button" variant="ghost">
              <a href="/dashboard/sablens">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Cancel
              </a>
            </Button>
            <Button type="submit" variant="primary" loading={isPending}>
              {isPending ? 'Creating' : 'Create session'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
