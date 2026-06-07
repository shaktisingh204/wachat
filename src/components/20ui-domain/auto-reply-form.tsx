'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  Field,
  Switch,
  Textarea,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyState,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save, Trash2, PlusCircle, MessageSquareText } from 'lucide-react';
import { handleUpdateAutoReplySettings } from '@/app/actions/project.actions';
import type { WithId,
  Project,
  GeneralReplyRule } from '@/lib/definitions';
import { timezones } from '@/lib/timezones';

import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
      Save
    </Button>
  );
}

interface AutoReplyFormProps {
  type: 'welcomeMessage' | 'general' | 'inactiveHours' | 'aiAssistant';
  project: WithId<Project>;
}

const formDetails = {
    welcomeMessage: { title: 'Welcome Message', description: 'Greet users the first time they message you.' },
    general: { title: 'Keyword Auto-Replies', description: 'Reply automatically based on keywords in the user\'s message.' },
    inactiveHours: { title: 'Away Message', description: 'Reply automatically when you are not available (business hours).' },
    aiAssistant: { title: 'AI Assistant', description: 'Use AI to answer questions based on your business context.' },
};

export function AutoReplyForm({ type, project }: AutoReplyFormProps) {
  const [state, formAction] = useActionState(handleUpdateAutoReplySettings as any, initialState as any);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [replies, setReplies] = useState<GeneralReplyRule[]>([]);

  // AI assistant
  const [autoTranslate, setAutoTranslate] = useState(false);

  // Inactive hours days
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
      toast({ title: 'Success', description: state.message, tone: 'success' });
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, tone: 'danger' });
    }
  }, [state, toast]);

  const addReplyRule = () => {
    setReplies(prev => [...prev, { id: uuidv4(), keywords: '', reply: '', matchType: 'contains' }]);
  };

  const removeReplyRule = (id: string) => {
    setReplies(prev => prev.filter(rule => rule.id !== id));
  };

  const handleReplyRuleChange = (id: string, field: 'keywords' | 'reply' | 'matchType', value: string) => {
      setReplies(prev => prev.map(rule => rule.id === id ? {...rule, [field]: value} : rule));
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const renderFormContent = () => {
    switch (type) {
        case 'welcomeMessage':
            return (
              <Field label="Message">
                <Textarea name="message" defaultValue={project.autoReplySettings?.welcomeMessage?.message || ''} placeholder="Hello! Welcome to our business. How can we help you today?" />
              </Field>
            );

        case 'aiAssistant':
            return (
                <div className="space-y-4">
                    <Field label="Business Context" help="Provide information about your business for the AI to use when answering questions.">
                        <Textarea name="context" className="min-h-32" defaultValue={project.autoReplySettings?.aiAssistant?.context || ''} placeholder="We are a clothing store specializing in men's fashion. Our business hours are 9 AM to 6 PM. We offer free shipping on orders above $50." />
                    </Field>
                    <Switch
                        checked={autoTranslate}
                        onCheckedChange={setAutoTranslate}
                        label="Auto-detect and translate to the user's language"
                    />
                </div>
            );

        case 'inactiveHours': {
            const settings = project.autoReplySettings?.inactiveHours;
            return (
                 <div className="space-y-4">
                    <Field label="Away Message">
                        <Textarea name="message" defaultValue={settings?.message || ''} placeholder="Thanks for reaching out! We are currently away. Our business hours are Mon-Fri 9 AM to 6 PM. We will get back to you as soon as possible." />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Away From (Start)">
                            <Input name="startTime" type="time" defaultValue={settings?.startTime || '20:00'} />
                        </Field>
                        <Field label="Available At (End)">
                            <Input name="endTime" type="time" defaultValue={settings?.endTime || '08:00'} />
                        </Field>
                    </div>
                    <Field label="Timezone">
                        <Select name="timezone" defaultValue={settings?.timezone || 'Asia/Kolkata'}>
                            <SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-60">{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Active on these days" help="Away message will be sent on selected days during the inactive hours.">
                        <div className="flex flex-wrap gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                <Button
                                    key={day}
                                    type="button"
                                    size="sm"
                                    variant={selectedDays.includes(index) ? 'primary' : 'outline'}
                                    aria-pressed={selectedDays.includes(index)}
                                    onClick={() => toggleDay(index)}
                                >
                                    {day}
                                </Button>
                            ))}
                        </div>
                    </Field>
                </div>
            );
        }

        case 'general': {
            return (
                <div className="space-y-4">
                    {replies.length === 0 && (
                        <EmptyState
                            icon={MessageSquareText}
                            title="No keyword rules yet"
                            description="Add a rule below to reply automatically based on keywords."
                        />
                    )}
                    {replies.map((rule) => (
                        <div key={rule.id} className="relative space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                            <IconButton
                                label="Remove rule"
                                icon={Trash2}
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1"
                                onClick={() => removeReplyRule(rule.id)}
                            />
                            <Field label="Keywords (comma-separated)">
                                <Input value={rule.keywords} onChange={(e) => handleReplyRuleChange(rule.id, 'keywords', e.target.value)} placeholder="hello, hi, hey" />
                            </Field>
                            <Field label="Reply Message">
                                <Textarea value={rule.reply} onChange={(e) => handleReplyRuleChange(rule.id, 'reply', e.target.value)} placeholder="Hi there! How can I help you?" />
                            </Field>
                            <Select value={rule.matchType} onValueChange={(val) => handleReplyRuleChange(rule.id, 'matchType', val)}>
                                <SelectTrigger className="w-[180px]" aria-label="Match type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contains">Contains keyword</SelectItem>
                                    <SelectItem value="exact">Exact match</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" iconLeft={PlusCircle} onClick={addReplyRule}>Add Rule</Button>
                </div>
            )
        }
        default: return null;
    }
  }

  return (
    <Card>
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <input type="hidden" name="replyType" value={type} />
        <input type="hidden" name="enabled" value={isEnabled ? 'true' : 'false'} />
        {type === 'general' && <input type="hidden" name="replies" value={JSON.stringify(replies)} />}
        {type === 'aiAssistant' && <input type="hidden" name="autoTranslate" value={autoTranslate ? 'true' : 'false'} />}
        {type === 'inactiveHours' && selectedDays.map(d => (
            <input key={d} type="hidden" name={`day_${d}`} value="true" />
        ))}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
                <CardTitle>{formDetails[type].title}</CardTitle>
                <CardDescription>{formDetails[type].description}</CardDescription>
            </div>
            <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                aria-label={`Enable ${formDetails[type].title}`}
            />
          </div>
        </CardHeader>
        <CardBody className={cn(!isEnabled && 'opacity-50 pointer-events-none')}>
          {renderFormContent()}
        </CardBody>
        <CardFooter className={cn(!isEnabled && 'hidden')}>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
