'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getGreetingMessage,
  saveGreetingMessage,
  getAwayMessage,
  saveAwayMessage,
} from '@/app/actions/wachat-features.actions';

import * as React from 'react';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];

export default function GreetingMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  // Greeting State
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingType, setGreetingType] = useState<'single' | 'ab_test'>('single');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [greetingVariantA, setGreetingVariantA] = useState('');
  const [greetingVariantB, setGreetingVariantB] = useState('');
  const [showGreetingPreview, setShowGreetingPreview] = useState(true);

  // Away State
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMessage, setAwayMessage] = useState('');
  const [awaySchedule, setAwaySchedule] = useState('always');
  const [awayTimeFrom, setAwayTimeFrom] = useState('');
  const [awayTimeTo, setAwayTimeTo] = useState('');
  const [showAwayPreview, setShowAwayPreview] = useState(true);

  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [gRes, aRes] = await Promise.all([
        getGreetingMessage(projectId),
        getAwayMessage(projectId),
      ]);

      if (gRes.error) {
        toast({ title: 'Error', description: gRes.error, variant: 'destructive' });
      } else if (gRes.config) {
        setGreetingEnabled(gRes.config.enabled ?? false);
        const msg = gRes.config.message ?? '';
        try {
          const parsed = JSON.parse(msg);
          if (parsed && typeof parsed === 'object' && parsed.type) {
            setGreetingType(parsed.type);
            if (parsed.type === 'ab_test') {
              setGreetingVariantA(parsed.variantA || '');
              setGreetingVariantB(parsed.variantB || '');
              setGreetingMessage(parsed.message || '');
            } else {
              setGreetingMessage(parsed.message || '');
            }
          } else {
            setGreetingMessage(msg);
            setGreetingType('single');
          }
        } catch {
          setGreetingMessage(msg);
          setGreetingType('single');
        }
      }

      if (aRes.error) {
        toast({ title: 'Error', description: aRes.error, variant: 'destructive' });
      } else if (aRes.config) {
        setAwayEnabled(aRes.config.enabled ?? false);
        setAwayMessage(aRes.config.message ?? '');
        setAwaySchedule(aRes.config.schedule ?? 'always');
        setAwayTimeFrom(aRes.config.timeFrom ?? '');
        setAwayTimeTo(aRes.config.timeTo ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderPreviewText = (msg: string) => {
    if (!msg) return null;
    return msg
      .replace(/\{\s*name\s*\}/gi, 'John Doe')
      .replace(/\{\s*phone\s*\}/gi, '+1 234 567 890')
      .replace(/\{\s*email\s*\}/gi, 'john@example.com')
      .replace(/\{\s*company\s*\}/gi, activeProject?.name || 'Acme Inc');
  };

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      let greetingPayload = greetingMessage;
      if (greetingType === 'ab_test') {
        greetingPayload = JSON.stringify({
          type: 'ab_test',
          variantA: greetingVariantA,
          variantB: greetingVariantB,
        });
      } else {
        // Only stringify if previously JSON, or just always stringify to maintain standard
        greetingPayload = JSON.stringify({
          type: 'single',
          message: greetingMessage,
        });
      }

      const [gRes, aRes] = await Promise.all([
        saveGreetingMessage(projectId, greetingEnabled, greetingPayload),
        saveAwayMessage(projectId, awayEnabled, awayMessage, awaySchedule, awayTimeFrom, awayTimeTo),
      ]);

      if (gRes.error || aRes.error) {
        toast({
          title: 'Error',
          description: gRes.error || aRes.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Saved',
        description: 'Settings updated successfully.',
      });
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Skeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Greeting & Away Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Greeting & Away Messages</ZoruPageTitle>
          <ZoruPageDescription>
            Configure the welcome messages and after-hours away messages sent to contacts.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save /> {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* LEFT COLUMN: GREETING */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zoru-ink">Greeting Message</h2>
          
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-medium text-zoru-ink">Enable greeting</h3>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  Automatically send a greeting when a contact messages for the first time.
                </p>
              </div>
              <Switch
                checked={greetingEnabled}
                onCheckedChange={setGreetingEnabled}
                aria-label="Enable greeting"
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
               <div>
                  <h3 className="text-[15px] font-medium text-zoru-ink">A/B Testing</h3>
                  <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                    Test two different greetings to see which performs better.
                  </p>
               </div>
               <Switch
                 checked={greetingType === 'ab_test'}
                 onCheckedChange={(c) => setGreetingType(c ? 'ab_test' : 'single')}
                 aria-label="Enable A/B testing"
               />
            </div>

            {greetingType === 'ab_test' ? (
              <div className="flex flex-col gap-6 border-t border-zoru-line pt-4">
                <div className="flex flex-col gap-3">
                  <Label>Variant A</Label>
                  <Textarea
                    value={greetingVariantA}
                    onChange={(e) => setGreetingVariantA(e.target.value)}
                    rows={3}
                    placeholder="Type your greeting message…"
                  />
                  <VariableInserter onInsert={(v) => setGreetingVariantA(prev => prev + ' ' + v)} />
                </div>
                <div className="flex flex-col gap-3">
                  <Label>Variant B</Label>
                  <Textarea
                    value={greetingVariantB}
                    onChange={(e) => setGreetingVariantB(e.target.value)}
                    rows={3}
                    placeholder="Type your alternative greeting…"
                  />
                  <VariableInserter onInsert={(v) => setGreetingVariantB(prev => prev + ' ' + v)} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-t border-zoru-line pt-4">
                <Label>Message</Label>
                <Textarea
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your greeting message…"
                />
                <VariableInserter onInsert={(v) => setGreetingMessage(prev => prev + ' ' + v)} />
              </div>
            )}
          </Card>

          <PreviewCard
             title="Greeting Preview"
             show={showGreetingPreview}
             onToggle={() => setShowGreetingPreview(!showGreetingPreview)}
             content={
               greetingType === 'ab_test' ? (
                 <div className="flex flex-col gap-4">
                   <div>
                     <span className="mb-1 block text-xs font-semibold text-zoru-ink-muted">Variant A</span>
                     <PreviewBubble rendered={renderPreviewText(greetingVariantA)} />
                   </div>
                   <div>
                     <span className="mb-1 block text-xs font-semibold text-zoru-ink-muted">Variant B</span>
                     <PreviewBubble rendered={renderPreviewText(greetingVariantB)} />
                   </div>
                 </div>
               ) : (
                 <PreviewBubble rendered={renderPreviewText(greetingMessage)} />
               )
             }
          />
        </div>

        {/* RIGHT COLUMN: AWAY */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zoru-ink">Away Message</h2>
          
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-medium text-zoru-ink">Enable away message</h3>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  Send a response when you are unavailable.
                </p>
              </div>
              <Switch
                checked={awayEnabled}
                onCheckedChange={setAwayEnabled}
                aria-label="Enable away message"
              />
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <Label>Schedule</Label>
              <Select value={awaySchedule} onValueChange={setAwaySchedule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always active</SelectItem>
                  <SelectItem value="outside_business_hours">Outside business hours</SelectItem>
                  <SelectItem value="custom">Custom schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {awaySchedule === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>From</Label>
                  <Input 
                    type="time" 
                    value={awayTimeFrom} 
                    onChange={(e) => setAwayTimeFrom(e.target.value)} 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>To</Label>
                  <Input 
                    type="time" 
                    value={awayTimeTo} 
                    onChange={(e) => setAwayTimeTo(e.target.value)} 
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-zoru-line pt-4">
              <Label>Message</Label>
              <Textarea
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                rows={4}
                placeholder="Type your away message…"
              />
              <VariableInserter onInsert={(v) => setAwayMessage(prev => prev + ' ' + v)} />
            </div>
          </Card>

          <PreviewCard
             title="Away Preview"
             show={showAwayPreview}
             onToggle={() => setShowAwayPreview(!showAwayPreview)}
             content={<PreviewBubble rendered={renderPreviewText(awayMessage)} />}
          />
        </div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function VariableInserter({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-zoru-ink-muted">Insert:</span>
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2 py-1 font-mono text-[11px] text-zoru-ink transition-colors hover:bg-zoru-surface"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function PreviewCard({ title, show, onToggle, content }: { title: string, show: boolean, onToggle: () => void, content: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] text-zoru-ink">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {show ? <EyeOff /> : <Eye />}
          {show ? 'Hide' : 'Show'}
        </Button>
      </div>
      {show && (
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
          {content}
        </div>
      )}
    </Card>
  );
}

function PreviewBubble({ rendered }: { rendered: string | null }) {
  return (
    <div className="inline-block max-w-[80%] rounded-[var(--zoru-radius)] bg-zoru-surface-2 px-4 py-2.5 text-[13px] text-zoru-ink">
      {rendered || <span className="italic text-zoru-ink-muted">Empty message</span>}
    </div>
  );
}
