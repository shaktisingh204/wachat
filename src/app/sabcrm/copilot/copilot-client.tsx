'use client';

/**
 * SabCRM — Copilot chat surface (`/sabcrm/copilot`).
 *
 * A 20ui chat UI over the agentic `runCopilotTw` action. Each user turn shows
 * the assistant's reasoning steps (thoughts + tool calls + observations) in a
 * collapsible trace, then the final grounded answer. Honest degradation: with
 * no AI key / no quota the action returns the error, which we render inline.
 *
 * Icons render via `renderIcon` from the 20ui `_icon` helper (lucide icons are
 * forwardRef objects — never render them as raw components).
 */

import * as React from 'react';
import { Bot, Send, User, Wrench, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Textarea,
  Alert,
  Badge,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import { runCopilotTw } from '@/app/actions/sabcrm-copilot.actions';
import type { CopilotStep } from '@/lib/sabcrm/copilot';

/** One rendered turn in the conversation. */
interface ChatTurn {
  id: string;
  question: string;
  answer?: string;
  steps?: CopilotStep[];
  toolsUsed?: string[];
  budgetExhausted?: boolean;
  error?: string;
  loading: boolean;
}

const SUGGESTIONS = [
  'Which open deals over $10k are closing this month?',
  'Summarize the latest activity on Acme Corp.',
  'How many leads were created this week?',
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ── Reasoning trace ──────────────────────────────────────────────────────── */

function StepRow({ step }: { step: CopilotStep }): React.ReactElement {
  const tone = step.isError ? 'danger' : 'accent';
  return (
    <div className="flex flex-col gap-1 border-l-2 border-[var(--st-border)] pl-3">
      {step.thought && (
        <p className="text-[12px] italic text-[var(--st-text-secondary)]">{step.thought}</p>
      )}
      {step.tool && (
        <div className="flex items-center gap-2">
          {renderIcon(Wrench, { size: 13, 'aria-hidden': true })}
          <Badge tone={tone} kind="soft">
            {step.tool}
          </Badge>
          {step.args && Object.keys(step.args).length > 0 && (
            <code className="truncate text-[11px] text-[var(--st-text-secondary)]">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(step.args).filter(([k]) => k !== 'projectId'),
                ),
              ).slice(0, 120)}
            </code>
          )}
        </div>
      )}
      {step.observation && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[var(--st-bg-subtle)] p-2 text-[11px] leading-snug text-[var(--st-text-secondary)]">
          {step.observation.slice(0, 600)}
          {step.observation.length > 600 ? '\n…' : ''}
        </pre>
      )}
    </div>
  );
}

function ReasoningTrace({
  steps,
  toolsUsed,
}: {
  steps: CopilotStep[];
  toolsUsed?: string[];
}): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  const meaningful = steps.filter((s) => s.tool || s.thought || s.observation);
  if (meaningful.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--st-border)] pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 self-start text-[12px] font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        aria-expanded={open}
      >
        <span
          className="inline-flex transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          {renderIcon(ChevronDown, { size: 14, 'aria-hidden': true })}
        </span>
        {open ? 'Hide' : 'Show'} reasoning
        {toolsUsed && toolsUsed.length > 0 && (
          <span className="text-[var(--st-text-secondary)]">
            · {toolsUsed.length} tool{toolsUsed.length === 1 ? '' : 's'}
          </span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {meaningful.map((s) => (
            <StepRow key={s.index} step={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Turn card ────────────────────────────────────────────────────────────── */

function TurnCard({ turn }: { turn: ChatTurn }): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {/* Question */}
      <div className="flex items-start gap-2.5 self-end">
        <Card className="max-w-[80%] bg-[var(--st-accent-bg)] px-3 py-2 text-[14px] text-[var(--st-text)]">
          {turn.question}
        </Card>
        <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-subtle)] text-[var(--st-text-secondary)]">
          {renderIcon(User, { size: 15, 'aria-hidden': true })}
        </span>
      </div>

      {/* Answer */}
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-accent-bg)] text-[var(--st-accent)]">
          {renderIcon(Bot, { size: 15, 'aria-hidden': true })}
        </span>
        <Card className="flex w-full max-w-[80%] flex-col gap-2 px-3 py-2.5">
          {turn.loading ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
                {renderIcon(Bot, { size: 13, 'aria-hidden': true })}
                Thinking, retrieving, and calling tools…
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : turn.error ? (
            <Alert tone="danger" className="m-0">
              <span className="inline-flex items-center gap-1.5">
                {renderIcon(AlertTriangle, { size: 14, 'aria-hidden': true })}
                {turn.error}
              </span>
            </Alert>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                {turn.answer}
              </p>
              {turn.budgetExhausted && (
                <span className="text-[11px] text-[var(--st-text-secondary)]">
                  (stopped at the step limit — answer is best-effort)
                </span>
              )}
              {turn.steps && (
                <ReasoningTrace steps={turn.steps} toolsUsed={turn.toolsUsed} />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function CopilotClient(): React.ReactElement {
  const { activeProjectId } = useProject();

  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const send = React.useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      setBusy(true);
      setInput('');
      const id = uid();
      setTurns((prev) => [...prev, { id, question, loading: true }]);

      const res = await runCopilotTw(question, activeProjectId ?? undefined);

      setTurns((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (!res.ok) return { ...t, loading: false, error: res.error };
          return {
            ...t,
            loading: false,
            answer: res.data.answer,
            steps: res.data.steps,
            toolsUsed: res.data.toolsUsed,
            budgetExhausted: res.data.budgetExhausted,
          };
        }),
      );
      setBusy(false);
    },
    [activeProjectId, busy],
  );

  return (
    <div className="flex h-full flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              {renderIcon(Bot, { size: 18, 'aria-hidden': true })}
              Copilot
            </span>
          </PageTitle>
          <PageDescription>
            Ask in plain language. The copilot plans, retrieves the relevant
            records, and calls CRM tools — under your permissions — to answer or
            act.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Conversation */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {turns.length === 0 ? (
          <Card className="flex flex-col gap-3 p-[var(--st-space-4)]">
            <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--st-text)]">
              {renderIcon(CheckCircle2, { size: 15, 'aria-hidden': true })}
              Try asking
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-[var(--st-border)] px-3 py-1.5 text-[13px] text-[var(--st-text-secondary)] hover:border-[var(--st-accent)] hover:text-[var(--st-text)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        ) : (
          turns.map((t) => <TurnCard key={t.id} turn={t} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <Card className="flex items-end gap-2 p-[var(--st-space-3)]">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the copilot about your CRM…"
          rows={2}
          className="flex-1"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <Button
          variant="primary"
          iconLeft={Send}
          onClick={() => void send(input)}
          loading={busy}
          disabled={busy || !input.trim()}
        >
          Send
        </Button>
      </Card>
    </div>
  );
}
