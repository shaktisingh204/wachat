"use client";

import * as React from "react";
import {
  Headphones,
  Pause,
  Play,
  MicOff,
  Mic,
  PhoneForwarded,
  PhoneOff,
  Ear,
  Megaphone,
  Radio,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  listLiveCalls,
  holdCall,
  muteCall,
  transferCall,
  hangupCall,
  snoopCall,
  type LiveCall,
} from "./actions";

export default function SabcallAgentConsolePage() {
  const { toast } = useToast();
  const [calls, setCalls] = React.useState<LiveCall[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [engineOff, setEngineOff] = React.useState(false);
  const [transferFor, setTransferFor] = React.useState<string | null>(null);
  const [transferTo, setTransferTo] = React.useState("");

  const refresh = React.useCallback(async () => {
    const res = await listLiveCalls();
    if (res.ok) {
      setCalls(res.calls);
      setEngineOff(!res.engineEnabled);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = React.useCallback(
    async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      const res = await fn();
      if (res.ok) {
        toast({ title: label });
        void refresh();
      } else {
        toast({ title: `${label} failed`, description: res.error, variant: "destructive" });
      }
    },
    [toast, refresh],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Agent console</PageTitle>
          <PageDescription>
            Live calls on the engine — hold, mute, transfer, hang up, and
            supervisor-coach (monitor / whisper / barge) in real time.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {engineOff ? (
        <Card className="p-4 text-sm text-[var(--st-text-secondary)]">
          The call engine is disabled. Set <code>SABCALL_ENABLED=true</code> and connect
          Asterisk to see and control live calls here.
        </Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<Headphones aria-hidden />}
            title="No live calls"
            description="Active calls appear here as they connect."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {calls.map((c) => (
            <li key={c.id}>
              <Card className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                    <Radio className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--st-text)]">
                      {c.from || "Unknown"} → {c.to || "—"}
                    </div>
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      Channel {c.id}
                    </div>
                  </div>
                  <Badge variant="default">{c.state || "up"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" iconLeft={Pause} onClick={() => void act("Held", () => holdCall(c.id, true))}>Hold</Button>
                  <Button size="sm" variant="outline" iconLeft={Play} onClick={() => void act("Resumed", () => holdCall(c.id, false))}>Resume</Button>
                  <Button size="sm" variant="outline" iconLeft={MicOff} onClick={() => void act("Muted", () => muteCall(c.id, true))}>Mute</Button>
                  <Button size="sm" variant="outline" iconLeft={Mic} onClick={() => void act("Unmuted", () => muteCall(c.id, false))}>Unmute</Button>
                  <Button size="sm" variant="outline" iconLeft={PhoneForwarded} onClick={() => { setTransferFor(c.id); setTransferTo(""); }}>Transfer</Button>
                  <Button size="sm" variant="outline" iconLeft={Ear} onClick={() => void act("Monitoring", () => snoopCall(c.id, "monitor"))}>Monitor</Button>
                  <Button size="sm" variant="outline" iconLeft={Headphones} onClick={() => void act("Whispering", () => snoopCall(c.id, "whisper"))}>Whisper</Button>
                  <Button size="sm" variant="outline" iconLeft={Megaphone} onClick={() => void act("Barging", () => snoopCall(c.id, "barge"))}>Barge</Button>
                  <Button size="sm" variant="destructive" iconLeft={PhoneOff} onClick={() => void act("Hung up", () => hangupCall(c.id))}>Hang up</Button>
                </div>
                {transferFor === c.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      placeholder="Transfer to number or SIP endpoint"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!transferTo.trim()}
                      onClick={() =>
                        void act("Transferred", () => transferCall(c.id, transferTo.trim())).then(() =>
                          setTransferFor(null),
                        )
                      }
                    >
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTransferFor(null)}>Cancel</Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
