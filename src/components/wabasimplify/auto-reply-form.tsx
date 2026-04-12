
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Save, Trash2, PlusCircle } from 'lucide-react';
import { handleUpdateAutoReplySettings } from '@/app/actions/project.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project, GeneralReplyRule } from '@/lib/definitions';
import { Input } from '../ui/input';
import { timezones } from '@/lib/timezones';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
      toast({ title: 'Success!', description: state.message });
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
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
            return <div className="space-y-2"><Label htmlFor="message">Message</Label><Textarea id="message" name="message" defaultValue={project.autoReplySettings?.welcomeMessage?.message || ''} placeholder="Hello! 👋 Welcome to our business. How can we help you today?" /></div>;

        case 'aiAssistant':
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="context">Business Context</Label>
                        <Textarea id="context" name="context" className="min-h-32" defaultValue={project.autoReplySettings?.aiAssistant?.context || ''} placeholder="We are a clothing store specializing in men's fashion. Our business hours are 9 AM to 6 PM. We offer free shipping on orders above $50..." />
                        <p className="text-xs text-muted-foreground">Provide information about your business for the AI to use when answering questions.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch checked={autoTranslate} onCheckedChange={setAutoTranslate} />
                        <Label className="font-normal">Auto-detect & translate to user's language</Label>
                    </div>
                </div>
            );

        case 'inactiveHours': {
            const settings = project.autoReplySettings?.inactiveHours;
            return (
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="message">Away Message</Label>
                        <Textarea id="message" name="message" defaultValue={settings?.message || ''} placeholder="Thanks for reaching out! We're currently away. Our business hours are Mon-Fri 9 AM to 6 PM. We'll get back to you as soon as possible." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Away From (Start)</Label>
                            <Input id="startTime" name="startTime" type="time" defaultValue={settings?.startTime || '20:00'} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">Available At (End)</Label>
                            <Input id="endTime" name="endTime" type="time" defaultValue={settings?.endTime || '08:00'} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select name="timezone" defaultValue={settings?.timezone || 'Asia/Kolkata'}>
                            <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-60">{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Active on these days</Label>
                        <p className="text-xs text-muted-foreground mb-2">Away message will be sent on selected days during the inactive hours.</p>
                        <div className="flex flex-wrap gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(index)}
                                    className={cn(
                                        'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                                        selectedDays.includes(index)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-input hover:bg-accent'
                                    )}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        case 'general': {
            return (
                <div className="space-y-4">
                    {replies.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No keyword rules yet. Add one below.</p>
                    )}
                    {replies.map((rule) => (
                        <div key={rule.id} className="p-4 border rounded-lg space-y-3 relative bg-muted/50">
                             <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeReplyRule(rule.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            <div className="space-y-2">
                                <Label>Keywords (comma-separated)</Label>
                                <Input value={rule.keywords} onChange={(e) => handleReplyRuleChange(rule.id, 'keywords', e.target.value)} placeholder="hello, hi, hey" />
                            </div>
                            <div className="space-y-2">
                                <Label>Reply Message</Label>
                                <Textarea value={rule.reply} onChange={(e) => handleReplyRuleChange(rule.id, 'reply', e.target.value)} placeholder="Hi there! How can I help you?" />
                            </div>
                            <Select value={rule.matchType} onValueChange={(val) => handleReplyRuleChange(rule.id, 'matchType', val)}>
                                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contains">Contains keyword</SelectItem>
                                    <SelectItem value="exact">Exact match</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addReplyRule}><PlusCircle className="mr-2 h-4 w-4"/>Add Rule</Button>
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
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </CardHeader>
        <CardContent className={cn(!isEnabled && 'opacity-50 pointer-events-none')}>
          {renderFormContent()}
        </CardContent>
        <CardFooter className={cn(!isEnabled && 'hidden')}>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
