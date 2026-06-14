"use client";

import * as React from "react";
import { Mail, Sparkles } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { ProcessingDots } from "@/components/sabmail/motion";
import type { SabmailAccountRow } from "@/app/actions/sabmail-projects.actions";

import { askSabmailInbox, type SabmailAiSource } from "./actions";
import { ingestSabmailInbox } from "./ingest-actions";
import "@/components/sabmail/motion/sabmail-motion.css";

const SUGGESTIONS = [
  "What invoices are due this week?",
  "Summarize my conversation with the recruiter",
  "Did anyone confirm the meeting time?",
  "What did support say about my refund?",
];

export function SabmailAiClient({
  accounts,
}: {
  accounts: SabmailAccountRow[];
}) {
  const { toast } = useToast();

  const [accountId, setAccountId] = React.useState<string>(
    accounts[0]?.id ?? "",
  );
  const [question, setQuestion] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<SabmailAiSource[]>([]);
  const [asked, setAsked] = React.useState(false);
  const [indexing, setIndexing] = React.useState(false);

  const canAsk = !!accountId && !!question.trim() && !thinking;

  const buildIndex = React.useCallback(async () => {
    if (!accountId) {
      toast({ title: "Pick a mailbox first.", variant: "destructive" });
      return;
    }
    setIndexing(true);
    const res = await ingestSabmailInbox(accountId);
    setIndexing(false);
    if (!res.ok) {
      toast({ title: "Couldn't build the index", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "AI index updated",
      description: `Indexed ${res.count} message${res.count === 1 ? "" : "s"} for smarter, semantic answers.`,
    });
  }, [accountId, toast]);

  const ask = React.useCallback(async () => {
    const q = question.trim();
    if (!accountId) {
      toast({ title: "Pick a mailbox to ask about.", variant: "destructive" });
      return;
    }
    if (!q) return;

    setThinking(true);
    setAsked(true);
    setAnswer(null);
    setSources([]);

    const res = await askSabmailInbox({ accountId, question: q });
    setThinking(false);

    if (!res.ok) {
      toast({
        title: "Couldn't answer that",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setAnswer(res.answer);
    setSources(res.sources);
  }, [accountId, question, toast]);

  if (accounts.length === 0) {
    return (
      <div className="sabmail-canvas min-h-full p-4 sm:p-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--st-text)]">
              <Sparkles className="h-5 w-5 text-[var(--st-accent)]" aria-hidden />
              Ask AI
            </h1>
            <p className="text-sm text-[var(--st-text-secondary)]">
              Ask questions about your inbox in plain language.
            </p>
          </div>
          <div className="sabmail-pane mt-6 p-10">
            <EmptyState
              icon={<Mail aria-hidden />}
              title="No mailbox connected"
              description="Connect a mailbox first — then you can ask AI about anything in your inbox."
              action={
                <Button variant="primary" size="sm" asChild>
                  <a href="/sabmail/accounts">Connect a mailbox</a>
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--st-accent)]" aria-hidden />
              Ask AI
            </span>
          </PageTitle>
          <PageDescription>
            Ask anything about your inbox in plain language. The assistant
            searches your mail, then answers with citations to the messages it
            used.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ask a question</CardTitle>
            <CardDescription>
              Answers are grounded in your INBOX — nothing leaves your
              workspace except the matched excerpts sent to the model.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {accounts.length > 1 ? (
              <Field label="Mailbox">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a mailbox" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName ? `${a.displayName} · ${a.email}` : a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field label="Your question">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What invoices are due this week?"
                rows={3}
                disabled={thinking}
                onKeyDown={(e) => {
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    e.key === "Enter" &&
                    canAsk
                  ) {
                    e.preventDefault();
                    void ask();
                  }
                }}
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={thinking}
                    onClick={() => setQuestion(s)}
                    className="rounded-full border border-[var(--st-border)] px-3 py-1 text-xs text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={indexing}
                  disabled={indexing || !accountId}
                  onClick={() => void buildIndex()}
                >
                  Build AI index
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Sparkles}
                  loading={thinking}
                  disabled={!canAsk}
                  onClick={() => void ask()}
                >
                  Ask AI
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {!asked ? (
          <Card className="p-10">
            <EmptyState
              icon={<Sparkles aria-hidden />}
              title="Ask anything about your inbox"
              description="Try a question above — the assistant finds the relevant emails and answers with citations you can click through to."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4 text-[var(--st-accent)]"
                    aria-hidden
                  />
                  Answer
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {thinking ? (
                <div className="flex items-center gap-3 py-4 text-sm text-[var(--st-text-secondary)]">
                  <ProcessingDots className="text-[var(--st-accent)]" />
                  <span>Searching your inbox and reasoning over the matches…</span>
                </div>
              ) : answer ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--st-text)]">
                  {answer}
                </p>
              ) : null}

              {!thinking && sources.length > 0 ? (
                <div className="border-t border-[var(--st-border)] pt-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Sources
                  </div>
                  <ul className="sabmail-motion flex flex-col gap-2">
                    {sources.map((src, idx) => (
                      <li
                        key={src.n}
                        className="sabmail-stagger-item"
                        style={{ ["--i" as string]: idx } as React.CSSProperties}
                      >
                        <a
                          href={`/sabmail/inbox?path=INBOX&uid=${src.uid}`}
                          className="flex min-w-0 items-center gap-3 rounded-md border border-[var(--st-border)] px-3 py-2 transition-colors hover:bg-[var(--st-bg-muted)]"
                        >
                          <Badge variant="secondary" className="shrink-0">
                            {src.n}
                          </Badge>
                          <Mail
                            className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]"
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[var(--st-text)]">
                              {src.subject}
                            </span>
                            <span className="block truncate text-xs text-[var(--st-text-secondary)]">
                              {src.from}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
