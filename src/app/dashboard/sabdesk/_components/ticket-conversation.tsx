"use client";

import {
  Badge,
  Button,
  Card,
  Label,
  Textarea,
  useZoruToast,
} from "@/components/zoruui";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, Bot } from "lucide-react";

/**
 * <TicketConversation> — notes composer + internal-vs-public toggle
 * (§1D.2 conversation thread).
 *
 * Local-only for now: notes are appended into the ticket's
 * `internalNotes` array via `updateTicket`. Each note records author,
 * timestamp, body, and a `kind` of `public` (visible to the customer)
 * or `internal` (agents only).
 *
 * The composer also handles the Reply and Forward intents from the
 * header action group — the parent flips `mode` on this component to
 * pre-fill the textarea and badge.
 */

import * as React from "react";

import { updateTicket } from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

type NoteKind = "public" | "internal";

interface ConversationNote {
  id: string;
  body: string;
  kind: NoteKind;
  createdAt: string;
  authorId?: string;
}

interface TicketConversationProps {
  ticket: CrmTicketDoc;
  mode: "reply" | "forward" | "note";
  onModeChange: (m: "reply" | "forward" | "note") => void;
}

function readNotes(t: CrmTicketDoc): ConversationNote[] {
  const raw = Array.isArray(t.internalNotes)
    ? (t.internalNotes as unknown[])
    : [];
  return raw
    .map((n, idx): ConversationNote => {
      const obj = (n ?? {}) as Record<string, unknown>;
      return {
        id: String(obj.id ?? idx),
        body: String(obj.body ?? obj.text ?? ""),
        kind: obj.kind === "public" ? "public" : "internal",
        createdAt: String(obj.createdAt ?? obj.ts ?? new Date().toISOString()),
        authorId: obj.authorId ? String(obj.authorId) : undefined,
      };
    })
    .filter((n) => n.body.length > 0);
}

function fmtDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
}

export function TicketConversation({
  ticket,
  mode,
  onModeChange,
  children,
}: TicketConversationProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState<NoteKind>("public");
  const [pending, startTransition] = React.useTransition();

  const notes = React.useMemo(() => readNotes(ticket), [ticket]);

  const placeholder =
    mode === "forward"
      ? "Forwarding context to another agent or team…"
      : mode === "reply"
        ? "Reply to the requester…"
        : "Add an internal note for your team…";

  React.useEffect(() => {
    // Default kind based on intent.
    if (mode === "reply" || mode === "forward") setKind("public");
    if (mode === "note") setKind("internal");
  }, [mode]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const note: ConversationNote = {
          id: `n_${Date.now()}`,
          body: text,
          kind,
          createdAt: new Date().toISOString(),
        };
        const next = [...notes, note];
        await updateTicket(String(ticket._id), {
          internalNotes: next as unknown,
        });
        toast({ title: mode === "reply" ? "Reply added" : "Note saved" });
        setBody("");
        onModeChange("note");
        router.refresh();
      } catch (e) {
        toast({
          title: "Could not save",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  };

  const suggestReply = () => {
    // In a real implementation this would fetch from an AI endpoint hitting the knowledge base.
    setBody(
      (prev) =>
        (prev ? prev + "\n\n" : "") +
        `[AI Suggestion] Hello,\n\nBased on our knowledge base, here are some steps that might resolve your issue:\n1. Restart the application.\n2. Clear your browser cache.\n\nPlease let us know if you need further assistance.`,
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Conversation
      </h3>

      {children}

      <div className="flex flex-col gap-2">
        <div className="inline-flex rounded-md border border-zoru-line p-0.5 self-start">
          {(["note", "reply", "forward"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onModeChange(m)}
              className={[
                "rounded-sm px-2 py-1 text-[12px] capitalize",
                mode === m
                  ? "bg-zoru-surface text-zoru-ink"
                  : "text-zoru-ink-muted hover:text-zoru-ink",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>

        <Label
          htmlFor="ticket-note-body"
          className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle"
        >
          Message
        </Label>
        <Textarea
          id="ticket-note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={4}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
              <input
                type="checkbox"
                checked={kind === "internal"}
                onChange={(e) =>
                  setKind(e.target.checked ? "internal" : "public")
                }
                className="h-3.5 w-3.5"
              />
              Internal (not visible to requester)
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suggestReply}
            >
              <Bot className="mr-1.5 h-3.5 w-3.5" /> AI Suggest Reply
            </Button>
          </div>
          <Button
            size="sm"
            onClick={submit}
            disabled={pending || body.trim().length === 0}
          >
            {pending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default TicketConversation;
