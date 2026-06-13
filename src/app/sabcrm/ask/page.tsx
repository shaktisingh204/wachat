'use client';

/**
 * SabCRM — Ask your CRM (`/sabcrm/ask`).
 *
 * Natural-language Q&A grounded in the project's records (semantic retrieval
 * with keyword fallback) + a one-click "Enable semantic search" that seeds the
 * embedding index. Degrades honestly: with no AI key it still answers via the
 * keyword RAG (or surfaces the configuration error).
 */

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Send, Database } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Field,
  Textarea,
  Alert,
  Badge,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { askCrmTw, reindexSemanticTw } from '@/app/actions/sabcrm-ask.actions';

interface Source {
  object: string;
  id: string;
  label: string;
}

export default function AskCrmPage(): React.ReactElement {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [question, setQuestion] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  async function ask(): Promise<void> {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    const res = await askCrmTw(q, activeProjectId ?? undefined);
    setAsking(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAnswer(res.data.answer);
    setSources(res.data.sources);
  }

  async function enableSemantic(): Promise<void> {
    setSeeding(true);
    const res = await reindexSemanticTw(activeProjectId ?? undefined);
    setSeeding(false);
    if (!res.ok) {
      toast({ title: 'Could not enable semantic search', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Semantic search enabled',
      description: `Embedded ${res.data.updated} of ${res.data.scanned} records.`,
      tone: 'success',
    });
  }

  return (
    <div className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Ask your CRM</PageTitle>
          <PageDescription>
            Ask a question in plain language — answered only from your records,
            with the records it used cited below.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={Database}
            onClick={enableSemantic}
            loading={seeding}
            disabled={seeding}
          >
            Enable / refresh semantic search
          </Button>
        </PageActions>
      </PageHeader>

      <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
        <Field label="Your question">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which open deals over $10k are closing this month?"
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void ask();
            }}
          />
        </Field>
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            iconLeft={Send}
            onClick={ask}
            loading={asking}
            disabled={asking || !question.trim()}
          >
            Ask
          </Button>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {asking && <Skeleton className="h-28 w-full" />}

      {answer && (
        <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--st-text)]">
            <Sparkles size={15} aria-hidden="true" />
            Answer
          </div>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
            {answer}
          </p>
          {sources.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                Grounded on {sources.length} record{sources.length === 1 ? '' : 's'}:
              </span>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Link key={`${s.object}-${s.id}`} href={`/sabcrm/${s.object}/${s.id}`}>
                    <Badge tone="accent" kind="soft">
                      {s.label || `${s.object} ${s.id.slice(-6)}`}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
