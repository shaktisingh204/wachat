'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
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

import { handleUpdateAutoReplySettings } from '@/app/actions/project.actions';
import type { GeneralReplyRule,
  Project,
  WithId } from '@/lib/definitions';
import { timezones } from '@/lib/timezones';

/**
 * AutoReplyForm (wachat-local, ZoruUI).
 *
 * Replaces the legacy auto-reply-form. Same server
 * action (handleUpdateAutoReplySettings), same hidden form fields,
 * same per-type behavior (welcome / general / inactiveHours / aiAssistant).
 */

import * as React from 'react';

const initialState: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
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
    handleUpdateAutoReplySettings as any,
    initialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [replies, setReplies] = useState<GeneralReplyRule[]>([]);

  const [autoTranslate, setAutoTranslate] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

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
      }
    }
  }, [project, type]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              defaultValue={
                project.autoReplySettings?.welcomeMessage?.message || ''
              }
              placeholder="Hello! 👋 Welcome to our business. How can we help you today?"
            />
          </div>
        );

      case 'aiAssistant':
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="context">Business Context</Label>
              <Textarea
                id="context"
                name="context"
                className="min-h-32"
                defaultValue={
                  project.autoReplySettings?.aiAssistant?.context || ''
                }
                placeholder="We are a clothing store specializing in men's fashion. Our business hours are 9 AM to 6 PM. We offer free shipping on orders above $50..."
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Provide information about your business for the AI to use when
                answering questions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={autoTranslate}
                onCheckedChange={setAutoTranslate}
              />
              <Label className="font-normal">
                Auto-detect &amp; translate to user&apos;s language
              </Label>
            </div>
          </div>
        );

      case 'inactiveHours': {
        const settings = project.autoReplySettings?.inactiveHours;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Away Message</Label>
              <Textarea
                id="message"
                name="message"
                defaultValue={settings?.message || ''}
                placeholder="Thanks for reaching out! We're currently away. Our business hours are Mon-Fri 9 AM to 6 PM. We'll get back to you as soon as possible."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startTime">Away From (Start)</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue={settings?.startTime || '20:00'}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endTime">Available At (End)</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue={settings?.endTime || '08:00'}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                name="timezone"
                defaultValue={settings?.timezone || 'Asia/Kolkata'}
              >
                <ZoruSelectTrigger id="timezone">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent className="max-h-60">
                  {timezones.map((tz) => (
                    <ZoruSelectItem key={tz} value={tz}>
                      {tz}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Active on these days</Label>
              <p className="text-[11.5px] text-zoru-ink-muted">
                Away message will be sent on selected days during the inactive
                hours.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                        selectedDays.includes(index)
                          ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                          : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:bg-zoru-surface-2',
                      )}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'general': {
        return (
          <div className="flex flex-col gap-4">
            {replies.length === 0 && (
              <p className="text-[13px] italic text-zoru-ink-muted">
                No keyword rules yet. Add one below.
              </p>
            )}
            {replies.map((rule) => (
              <div
                key={rule.id}
                className="relative flex flex-col gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-4"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove rule"
                  className="absolute right-1 top-1 text-zoru-danger hover:bg-zoru-danger/10"
                  onClick={() => removeReplyRule(rule.id)}
                >
                  <Trash2 />
                </Button>
                <div className="flex flex-col gap-1.5">
                  <Label>Keywords (comma-separated)</Label>
                  <Input
                    value={rule.keywords}
                    onChange={(e) =>
                      handleReplyRuleChange(rule.id, 'keywords', e.target.value)
                    }
                    placeholder="hello, hi, hey"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Reply Message</Label>
                  <Textarea
                    value={rule.reply}
                    onChange={(e) =>
                      handleReplyRuleChange(rule.id, 'reply', e.target.value)
                    }
                    placeholder="Hi there! How can I help you?"
                  />
                </div>
                <Select
                  value={rule.matchType}
                  onValueChange={(val) =>
                    handleReplyRuleChange(rule.id, 'matchType', val)
                  }
                >
                  <ZoruSelectTrigger className="h-8 w-[180px] text-[12px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="contains">
                      Contains keyword
                    </ZoruSelectItem>
                    <ZoruSelectItem value="exact">Exact match</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addReplyRule}
            >
              <PlusCircle />
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
    <Card>
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
        <ZoruCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <ZoruCardTitle>{formDetails[type].title}</ZoruCardTitle>
              <ZoruCardDescription>
                {formDetails[type].description}
              </ZoruCardDescription>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </ZoruCardHeader>
        <ZoruCardContent
          className={cn(!isEnabled && 'pointer-events-none opacity-50')}
        >
          {renderFormContent()}
        </ZoruCardContent>
        <ZoruCardFooter className={cn(!isEnabled && 'hidden')}>
          <SubmitButton />
        </ZoruCardFooter>
      </form>
    </Card>
  );
}
