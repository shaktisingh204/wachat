"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Smile, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  deleteSla,
  deleteSurvey,
  saveSla,
  saveSurvey,
} from "@/app/actions/sabchat-support.actions";
import type { SabChatSla } from "@/lib/rust-client/sabchat-sla";
import type { SabChatSurvey, SabChatSurveyKind } from "@/lib/rust-client/sabchat-csat";

type Tab = "sla" | "csat";

export function SettingsClient({
  initialSlas,
  initialSurveys,
}: {
  initialSlas: SabChatSla[];
  initialSurveys: SabChatSurvey[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("sla");

  const handle = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    const res = await fn();
    if (res.ok) {
      if (msg) toast({ title: msg });
      router.refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
    return res.ok;
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Settings</PageTitle>
          <PageDescription>SLA targets and satisfaction surveys.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex gap-1 border-b border-[var(--st-border)]">
        {[
          { id: "sla" as const, label: "SLA policies", icon: ShieldCheck },
          { id: "csat" as const, label: "CSAT surveys", icon: Smile },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.id
                  ? "border-[var(--st-primary,var(--st-accent))] font-medium text-[var(--st-text)]"
                  : "border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "sla" ? (
          <SlaSection slas={initialSlas} onAction={handle} />
        ) : (
          <CsatSection surveys={initialSurveys} onAction={handle} />
        )}
      </div>
    </div>
  );
}

type Runner = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => Promise<boolean>;

function SlaSection({ slas, onAction }: { slas: SabChatSla[]; onAction: Runner }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [frt, setFrt] = React.useState("");
  const [res, setRes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New SLA
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {slas.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No SLA policies yet.</p>
        ) : (
          slas.map((s) => (
            <div key={s._id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">{s.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  First response {s.firstResponseMinutes ?? "—"}m · Resolution{" "}
                  {s.resolutionMinutes ?? "—"}m
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteSla(s._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New SLA policy</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First response (min)">
              <Input type="number" value={frt} onChange={(e) => setFrt(e.target.value)} />
            </Field>
            <Field label="Resolution (min)">
              <Input type="number" value={res} onChange={(e) => setRes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () =>
                    saveSla({
                      name,
                      firstResponseMinutes: frt ? Number(frt) : undefined,
                      resolutionMinutes: res ? Number(res) : undefined,
                    }),
                  "Created",
                );
                setBusy(false);
                if (ok) {
                  setName("");
                  setFrt("");
                  setRes("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CsatSection({ surveys, onAction }: { surveys: SabChatSurvey[]; onAction: Runner }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<SabChatSurveyKind>("csat");
  const [question, setQuestion] = React.useState("How would you rate the support you received?");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New survey
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {surveys.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No surveys yet.</p>
        ) : (
          surveys.map((s) => (
            <div key={s._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{s.name}</p>
                <p className="truncate text-xs text-[var(--st-text-secondary)]">{s.question}</p>
              </div>
              <Badge variant="secondary" className="uppercase">
                {s.kind}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteSurvey(s._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New survey</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Type">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SabChatSurveyKind)}
                className="w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 py-2 text-sm uppercase text-[var(--st-text)]"
              >
                <option value="csat">CSAT</option>
                <option value="nps">NPS</option>
                <option value="ces">CES</option>
              </select>
            </Field>
          </div>
          <Field label="Question">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim() || !question.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(() => saveSurvey({ name, kind, question }), "Created");
                setBusy(false);
                if (ok) {
                  setName("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
