"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";

import {
  Button,
  Card,
  Field,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

import { startVoiceBroadcast, type BroadcastScope } from "./actions";

const SCOPES: { value: BroadcastScope; label: string }[] = [
  { value: "all", label: "All active contacts" },
  { value: "vip", label: "VIP contacts only" },
  { value: "tag", label: "Contacts with a tag" },
];

export default function SabcallBroadcastPage() {
  const { toast } = useToast();
  const [scope, setScope] = React.useState<BroadcastScope>("vip");
  const [tag, setTag] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [callerId, setCallerId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const run = React.useCallback(async () => {
    if (!message.trim()) {
      toast({ title: "Add a message", variant: "destructive" });
      return;
    }
    setBusy(true);
    const res = await startVoiceBroadcast({
      scope,
      tag: scope === "tag" ? tag.trim() : undefined,
      message: message.trim(),
      callerId: callerId.trim() || undefined,
    });
    setBusy(false);
    if (res.success) {
      toast({
        title: "Broadcast started",
        description: `Queued ${res.queued} of ${res.total} call(s)${res.failed ? ` · ${res.failed} failed` : ""}.`,
      });
    } else {
      toast({ title: "Could not start broadcast", description: res.error, variant: "destructive" });
    }
  }, [scope, tag, message, callerId, toast]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Voice broadcast</PageTitle>
          <PageDescription>
            Reach a segment of your contacts with a call — everyone, your VIPs,
            or a tagged group. The engine places each call.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          <Megaphone className="h-4 w-4" aria-hidden /> New broadcast
        </div>

        <Field label="Audience">
          <SelectField
            value={scope}
            onChange={(v) => setScope((v as BroadcastScope) ?? "all")}
            options={SCOPES}
          />
        </Field>

        {scope === "tag" ? (
          <Field label="Tag">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. customers" />
          </Field>
        ) : null}

        <Field label="Message" help="Spoken to the contact (text-to-speech is enabled with the live engine).">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi, this is a quick update from our team…"
            rows={4}
          />
        </Field>

        <Field label="Caller ID (optional)">
          <Input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="+1 555 010 0000" />
        </Field>

        <div className="flex justify-end">
          <Button
            variant="primary"
            iconLeft={Megaphone}
            loading={busy}
            disabled={busy}
            onClick={() => void run()}
            className="sc-press"
          >
            Start broadcast
          </Button>
        </div>
      </Card>
    </main>
  );
}
