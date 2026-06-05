'use client';

import {
  Button,
  Card,
  Field,
  Skeleton,
  Switch,
  Textarea,
  Select,
  Input,
  useToast,
} from '@/components/sabcrm/20ui';
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

import { WachatPage } from '@/app/wachat/_components/wachat-page';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];

const SCHEDULE_OPTIONS = [
  { value: 'always', label: 'Always active' },
  { value: 'outside_business_hours', label: 'Outside business hours' },
  { value: 'custom', label: 'Custom schedule' },
];

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Greeting & Away Messages' },
];

export default function GreetingMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
        toast({ title: 'Error', description: gRes.error, tone: 'danger' });
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
        toast({ title: 'Error', description: aRes.error, tone: 'danger' });
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
          tone: 'danger',
        });
        return;
      }

      toast({
        title: 'Saved',
        description: 'Settings updated successfully.',
        tone: 'success',
      });
    });
  };

  if (isLoading) {
    return (
      <WachatPage breadcrumb={BREADCRUMB}>
        <div className="grid gap-4">
          <Skeleton height={96} />
          <Skeleton height={160} />
          <Skeleton height={128} />
        </div>
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      eyebrow="WaChat"
      title="Greeting & Away Messages"
      description="Configure the welcome messages and after-hours away messages sent to contacts."
      actions={
        <Button variant="primary" iconLeft={Save} onClick={handleSave} loading={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* LEFT COLUMN: GREETING */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--st-text)' }}>
            Greeting Message
          </h2>

          <Card padding="lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: 'var(--st-text)' }}>
                  Enable greeting
                </h3>
                <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--st-text-secondary)' }}>
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

          <Card padding="lg">
            <div className="mb-4 flex items-center justify-between gap-4">
               <div>
                  <h3 className="text-[15px] font-medium" style={{ color: 'var(--st-text)' }}>
                    A/B Testing
                  </h3>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--st-text-secondary)' }}>
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
              <div
                className="flex flex-col gap-6 pt-4"
                style={{ borderTop: '1px solid var(--st-border)' }}
              >
                <Field label="Variant A">
                  <Textarea
                    value={greetingVariantA}
                    onChange={(e) => setGreetingVariantA(e.target.value)}
                    rows={3}
                    placeholder="Type your greeting message…"
                  />
                  <VariableInserter onInsert={(v) => setGreetingVariantA(prev => prev + ' ' + v)} />
                </Field>
                <Field label="Variant B">
                  <Textarea
                    value={greetingVariantB}
                    onChange={(e) => setGreetingVariantB(e.target.value)}
                    rows={3}
                    placeholder="Type your alternative greeting…"
                  />
                  <VariableInserter onInsert={(v) => setGreetingVariantB(prev => prev + ' ' + v)} />
                </Field>
              </div>
            ) : (
              <div
                className="flex flex-col gap-3 pt-4"
                style={{ borderTop: '1px solid var(--st-border)' }}
              >
                <Field label="Message">
                  <Textarea
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    rows={4}
                    placeholder="Type your greeting message…"
                  />
                  <VariableInserter onInsert={(v) => setGreetingMessage(prev => prev + ' ' + v)} />
                </Field>
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
                     <span
                       className="mb-1 block text-xs font-semibold"
                       style={{ color: 'var(--st-text-secondary)' }}
                     >
                       Variant A
                     </span>
                     <PreviewBubble rendered={renderPreviewText(greetingVariantA)} />
                   </div>
                   <div>
                     <span
                       className="mb-1 block text-xs font-semibold"
                       style={{ color: 'var(--st-text-secondary)' }}
                     >
                       Variant B
                     </span>
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
          <h2 className="text-lg font-semibold" style={{ color: 'var(--st-text)' }}>
            Away Message
          </h2>

          <Card padding="lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-medium" style={{ color: 'var(--st-text)' }}>
                  Enable away message
                </h3>
                <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--st-text-secondary)' }}>
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

          <Card padding="lg" className="flex flex-col gap-5">
            <Field label="Schedule">
              <Select
                value={awaySchedule}
                onChange={(v) => setAwaySchedule(v ?? 'always')}
                options={SCHEDULE_OPTIONS}
                placeholder="Select schedule"
                aria-label="Schedule"
              />
            </Field>

            {awaySchedule === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From">
                  <Input
                    type="time"
                    value={awayTimeFrom}
                    onChange={(e) => setAwayTimeFrom(e.target.value)}
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="time"
                    value={awayTimeTo}
                    onChange={(e) => setAwayTimeTo(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <div
              className="flex flex-col gap-3 pt-4"
              style={{ borderTop: '1px solid var(--st-border)' }}
            >
              <Field label="Message">
                <Textarea
                  value={awayMessage}
                  onChange={(e) => setAwayMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your away message…"
                />
                <VariableInserter onInsert={(v) => setAwayMessage(prev => prev + ' ' + v)} />
              </Field>
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
    </WachatPage>
  );
}

// --- Subcomponents ---

function VariableInserter({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
        Insert:
      </span>
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="px-2 py-1 font-mono text-[11px] transition-colors"
          style={{
            borderRadius: 'var(--st-radius)',
            border: '1px solid var(--st-border)',
            background: 'var(--st-bg)',
            color: 'var(--st-text)',
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function PreviewCard({ title, show, onToggle, content }: { title: string, show: boolean, onToggle: () => void, content: React.ReactNode }) {
  return (
    <Card padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={show ? EyeOff : Eye}
          onClick={onToggle}
        >
          {show ? 'Hide' : 'Show'}
        </Button>
      </div>
      {show && (
        <div
          className="p-4"
          style={{
            borderRadius: 'var(--st-radius)',
            border: '1px solid var(--st-border)',
            background: 'var(--st-bg-secondary)',
          }}
        >
          {content}
        </div>
      )}
    </Card>
  );
}

function PreviewBubble({ rendered }: { rendered: string | null }) {
  return (
    <div
      className="inline-block max-w-[80%] px-4 py-2.5 text-[13px]"
      style={{
        borderRadius: 'var(--st-radius)',
        background: 'var(--st-bg)',
        border: '1px solid var(--st-border)',
        color: 'var(--st-text)',
      }}
    >
      {rendered || (
        <span className="italic" style={{ color: 'var(--st-text-secondary)' }}>
          Empty message
        </span>
      )}
    </div>
  );
}
