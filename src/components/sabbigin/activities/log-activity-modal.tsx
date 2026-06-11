'use client';

/**
 * SabBigin — Log activity modal.
 *
 * A reusable 20ui `<Modal>` that logs a Call / Email / Task / Meeting / Note
 * into `crm_activities` via `logSabbiginActivity`. Other SabBigin surfaces
 * (deal detail, contact detail) can mount this to capture a touch-point.
 *
 * Self-contained: pass `open` + `onClose`; optionally seed `defaultType`,
 * `contactId`, or `dealId` (e.g. when logging from a record). On success it
 * fires `onLogged` so the caller can refresh, plus a toast.
 */

import * as React from 'react';
import { useTransition } from 'react';
import { PhoneCall, Mail, CheckSquare, CalendarClock, StickyNote, Plus } from 'lucide-react';

import {
  Button,
  Modal,
  Field,
  Input,
  Textarea,
  SegmentedControl,
  toast,
} from '@/components/sabcrm/20ui';

import {
  logSabbiginActivity,
  type SabbiginActivityType,
} from '@/app/actions/sabbigin-activities.actions';

const TYPE_ITEMS: ReadonlyArray<{
  value: SabbiginActivityType;
  label: string;
  icon: typeof PhoneCall;
}> = [
  { value: 'Call', label: 'Call', icon: PhoneCall },
  { value: 'Email', label: 'Email', icon: Mail },
  { value: 'Task', label: 'Task', icon: CheckSquare },
  { value: 'Meeting', label: 'Meeting', icon: CalendarClock },
  { value: 'Note', label: 'Note', icon: StickyNote },
];

/** Types where capturing an inbound/outbound direction makes sense. */
const DIRECTIONAL: ReadonlySet<SabbiginActivityType> = new Set(['Call', 'Email']);

export interface LogActivityModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select the activity type (e.g. opening from the Calls surface). */
  defaultType?: SabbiginActivityType;
  /** Seed a linked contact id (logging from a contact record). */
  contactId?: string;
  /** Seed a linked deal id (logging from a deal record). */
  dealId?: string;
  /** Fired after a successful log so the caller can refresh its data. */
  onLogged?: (activityId: string) => void;
}

export function LogActivityModal({
  open,
  onClose,
  defaultType = 'Call',
  contactId,
  dealId,
  onLogged,
}: LogActivityModalProps): React.JSX.Element {
  const [type, setType] = React.useState<SabbiginActivityType>(defaultType);
  const [title, setTitle] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [direction, setDirection] = React.useState<'outbound' | 'inbound'>('outbound');
  const [notes, setNotes] = React.useState('');
  const [outcome, setOutcome] = React.useState('');
  const [linkContactId, setLinkContactId] = React.useState(contactId ?? '');
  const [linkDealId, setLinkDealId] = React.useState(dealId ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset the form whenever the modal (re)opens so it never shows stale input.
  React.useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setTitle('');
    setDueDate('');
    setDirection('outbound');
    setNotes('');
    setOutcome('');
    setLinkContactId(contactId ?? '');
    setLinkDealId(dealId ?? '');
    setError(null);
  }, [open, defaultType, contactId, dealId]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give this activity a short title.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await logSabbiginActivity({
        type,
        title: trimmed,
        dueDate: dueDate || undefined,
        direction: DIRECTIONAL.has(type) ? direction : undefined,
        notes: notes.trim() || undefined,
        outcome: outcome.trim() || undefined,
        contactId: linkContactId.trim() || undefined,
        dealId: linkDealId.trim() || undefined,
      });
      if (res.success) {
        toast.success({
          title: `${type} logged`,
          description: trimmed,
        });
        onLogged?.(res.activityId ?? '');
        onClose();
      } else {
        setError(res.error ?? 'Could not log this activity.');
        toast.error({
          title: 'Failed to log activity',
          description: res.error ?? 'Please try again.',
        });
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log activity"
      description="Record a call, email, task, meeting, or note against your pipeline."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            iconLeft={Plus}
            loading={isPending}
            onClick={handleSubmit}
          >
            Log activity
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Type">
          <SegmentedControl<SabbiginActivityType>
            items={TYPE_ITEMS.map((t) => ({
              value: t.value,
              label: t.label,
              icon: t.icon,
            }))}
            value={type}
            onChange={setType}
            size="sm"
            aria-label="Activity type"
          />
        </Field>

        <Field
          label="Title"
          required
          error={error ?? undefined}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'Call'
                ? 'e.g. Discovery call with Acme'
                : type === 'Email'
                  ? 'e.g. Sent pricing proposal'
                  : type === 'Meeting'
                    ? 'e.g. Demo with stakeholders'
                    : type === 'Note'
                      ? 'e.g. Budget confirmed for Q3'
                      : 'e.g. Follow up on contract'
            }
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Due date" help="Leave blank for an instant log.">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>

          {DIRECTIONAL.has(type) ? (
            <Field label="Direction">
              <SegmentedControl<'outbound' | 'inbound'>
                items={[
                  { value: 'outbound', label: 'Outbound' },
                  { value: 'inbound', label: 'Inbound' },
                ]}
                value={direction}
                onChange={setDirection}
                size="sm"
                fullWidth
                aria-label="Direction"
              />
            </Field>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What was discussed, agreed, or planned?"
          />
        </Field>

        <Field label="Outcome" help="A short result, e.g. 'Interested', 'No answer'.">
          <Input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Booked a follow-up"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact ID" help="Optional — link to a contact record.">
            <Input
              value={linkContactId}
              onChange={(e) => setLinkContactId(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Deal ID" help="Optional — link to a deal record.">
            <Input
              value={linkDealId}
              onChange={(e) => setLinkDealId(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default LogActivityModal;
