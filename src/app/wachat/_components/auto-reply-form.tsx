'use client';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  IconButton,
  Input,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2,
  PlusCircle,
  Save,
  Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { updateAutoReplySettings } from '@/app/actions/wachat-auto-reply-settings.actions';
import type { GeneralReplyRule,
  Project,
  WithId } from '@/lib/definitions';
import { timezones } from '@/lib/timezones';

/**
 * AutoReplyForm (wachat-local, 20ui).
 *
 * Replaces the legacy auto-reply-form. Now backed by the Rust crate via
 * `updateAutoReplySettings`, with the same hidden form fields and the
 * same per-type behavior (welcome / general / inactiveHours / aiAssistant).
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const initialState: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

const MATCH_TYPE_OPTIONS = [
  { value: 'contains', label: 'Contains keyword' },
  { value: 'exact', label: 'Exact match' },
];

const TIMEZONE_OPTIONS = timezones.map((tz) => ({ value: tz, label: tz }));

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} iconLeft={pending ? undefined : Save}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      Save
    </Button>
  );
}

interface AutoReplyFormProps {
  type: 'welcomeMessage' | 'general' | 'inactiveHours' | 'aiAssistant';
  project: WithId<Project>;
}

const formDetails = {
  welcomeMessage: {
    title: 'Welcome Message',
    description: 'Greet users the first time they message you.',
  },
  general: {
    title: 'Keyword Auto-Replies',
    description: "Reply automatically based on keywords in the user's message.",
  },
  inactiveHours: {
    title: 'Away Message',
    description:
      'Reply automatically when you are not available (business hours).',
  },
  aiAssistant: {
    title: 'AI Assistant',
    description: 'Use AI to answer questions based on your business context.',
  },
};

export function AutoReplyForm({ type, project }: AutoReplyFormProps) {
  const [state, formAction] = useActionState(
    updateAutoReplySettings as any,
    initialState as any,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [replies, setReplies] = useState<GeneralReplyRule[]>([]);

  const [autoTranslate, setAutoTranslate] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [timezone, setTimezone] = useState<string>(
    project.autoReplySettings?.inactiveHours?.timezone || 'Asia/Kolkata',
  );

  useEffect(() => {
    if (project.autoReplySettings?.[type]) {
      const settings = project.autoReplySettings[type];
      setIsEnabled(settings.enabled);
      if (type === 'general' && (settings as any).replies) {
        setReplies((settings as any).replies);
      }
      if (type === 'aiAssistant') {
        setAutoTranslate((settings as any).autoTranslate ?? false);
      }
      if (type === 'inactiveHours') {
        setSelectedDays((settings as any).days || []);
        setTimezone((settings as any).timezone || 'Asia/Kolkata');
      }
    }
  }, [project, type]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message, tone: 'success' });
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast]);

  const addReplyRule = () => {
    setReplies((prev) => [
      ...prev,
      { id: uuidv4(), keywords: '', reply: '', matchType: 'contains' },
    ]);
  };

  const removeReplyRule = (id: string) => {
    setReplies((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleReplyRuleChange = (
    id: string,
    field: 'keywords' | 'reply' | 'matchType',
    value: string,
  ) => {
    setReplies((prev) =>
      prev.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  const renderFormContent = () => {
    switch (type) {
      case 'welcomeMessage':
        return (
          <Field label="Message">
            <Textarea
              id="message"
              name="message"
              defaultValue={
                project.autoReplySettings?.welcomeMessage?.message || ''
              }
              placeholder="Hello! 👋 Welcome to our business. How can we help you today?"
            />
          </Field>
        );

      case 'aiAssistant':
        return (
          <div className="flex flex-col gap-4">
            <Field
              label="Business Context"
              help="Provide information about your business for the AI to use when answering questions."
            >
              <Textarea
                id="context"
                name="context"
                className="min-h-32"
                defaultValue={
                  project.autoReplySettings?.aiAssistant?.context || ''
                }
                placeholder="We are a clothing store specializing in men's fashion. Our business hours are 9 AM to 6 PM. We offer free shipping on orders above $50..."
              />
            </Field>
            <Switch
              checked={autoTranslate}
              onCheckedChange={setAutoTranslate}
              label="Auto-detect & translate to user's language"
            />
          </div>
        );

      case 'inactiveHours': {
        const settings = project.autoReplySettings?.inactiveHours;
        return (
          <div className="flex flex-col gap-4">
            <Field label="Away Message">
              <Textarea
                id="message"
                name="message"
                defaultValue={settings?.message || ''}
                placeholder="Thanks for reaching out! We're currently away. Our business hours are Mon-Fri 9 AM to 6 PM. We'll get back to you as soon as possible."
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Away From (Start)">
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue={settings?.startTime || '20:00'}
                />
              </Field>
              <Field label="Available At (End)">
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue={settings?.endTime || '08:00'}
                />
              </Field>
            </div>
            <Field label="Timezone">
              <Select
                aria-label="Timezone"
                value={timezone}
                onChange={(val) => setTimezone(val ?? 'Asia/Kolkata')}
                options={TIMEZONE_OPTIONS}
                searchable
              />
              <input type="hidden" name="timezone" value={timezone} />
            </Field>
            <Field
              label="Active on these days"
              help="Away message will be sent on selected days during the inactive hours."
            >
              <div className="mt-1 flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day, index) => {
                    const active = selectedDays.includes(index);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDay(index)}
                        className={cx(
                          'rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                          active
                            ? 'border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                            : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-muted)] hover:bg-[var(--st-surface-hover)]',
                        )}
                      >
                        {day}
                      </button>
                    );
                  },
                )}
              </div>
            </Field>
          </div>
        );
      }

      case 'general': {
        return (
          <div className="flex flex-col gap-4">
            {replies.length === 0 && (
              <p className="text-[13px] italic text-[var(--st-text-muted)]">
                No keyword rules yet. Add one below.
              </p>
            )}
            {replies.map((rule) => (
              <div
                key={rule.id}
                className="relative flex flex-col gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-surface)] p-4"
              >
                <IconButton
                  label="Remove rule"
                  icon={Trash2}
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 text-[var(--st-danger)] hover:bg-[var(--st-danger-soft)]"
                  onClick={() => removeReplyRule(rule.id)}
                />
                <Field label="Keywords (comma-separated)">
                  <Input
                    value={rule.keywords}
                    onChange={(e) =>
                      handleReplyRuleChange(rule.id, 'keywords', e.target.value)
                    }
                    placeholder="hello, hi, hey"
                  />
                </Field>
                <Field label="Reply Message">
                  <Textarea
                    value={rule.reply}
                    onChange={(e) =>
                      handleReplyRuleChange(rule.id, 'reply', e.target.value)
                    }
                    placeholder="Hi there! How can I help you?"
                  />
                </Field>
                <Select
                  aria-label="Match type"
                  value={rule.matchType}
                  onChange={(val) =>
                    handleReplyRuleChange(rule.id, 'matchType', val ?? 'contains')
                  }
                  options={MATCH_TYPE_OPTIONS}
                  size="sm"
                  className="w-[180px]"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              iconLeft={PlusCircle}
              onClick={addReplyRule}
            >
              Add Rule
            </Button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Card padding="none">
      <form action={formAction as any} ref={formRef}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <input type="hidden" name="replyType" value={type} />
        <input
          type="hidden"
          name="enabled"
          value={isEnabled ? 'true' : 'false'}
        />
        {type === 'general' && (
          <input type="hidden" name="replies" value={JSON.stringify(replies)} />
        )}
        {type === 'aiAssistant' && (
          <input
            type="hidden"
            name="autoTranslate"
            value={autoTranslate ? 'true' : 'false'}
          />
        )}
        {type === 'inactiveHours' &&
          selectedDays.map((d) => (
            <input key={d} type="hidden" name={`day_${d}`} value="true" />
          ))}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle>{formDetails[type].title}</CardTitle>
              <CardDescription>
                {formDetails[type].description}
              </CardDescription>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              aria-label={`Enable ${formDetails[type].title}`}
            />
          </div>
        </CardHeader>
        <CardBody
          className={cx(!isEnabled && 'pointer-events-none opacity-50')}
        >
          {renderFormContent()}
        </CardBody>
        <CardFooter className={cx(!isEnabled && 'hidden')}>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
