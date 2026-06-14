"use client";

import * as React from "react";
import { HeartHandshake, Phone, Check } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Skeleton,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  getTouchSettings,
  saveTouchSettings,
  listDueContacts,
  markTouched,
  type TouchSettings,
  type DueContact,
} from "./actions";
import { placeCall } from "../conversations/actions";

function sinceLabel(at: string | null): string {
  if (!at) return "never reached";
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d ago`;
}

export default function SabcallRelationshipsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<TouchSettings>({
    enabled: false,
    cadenceDays: 30,
    scope: "vip",
  });
  const [due, setDue] = React.useState<DueContact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, d] = await Promise.all([getTouchSettings(), listDueContacts()]);
    setSettings(s);
    if (d.ok) setDue(d.contacts);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = React.useCallback(async () => {
    setSaving(true);
    const res = await saveTouchSettings(settings);
    setSaving(false);
    if (res.success) {
      toast({ title: "Saved" });
      void load();
    } else {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
    }
  }, [settings, toast, load]);

  const touch = React.useCallback(
    async (id: string) => {
      const res = await markTouched(id);
      if (res.success) {
        setDue((d) => d.filter((c) => c._id !== id));
        toast({ title: "Marked touched" });
      } else {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
      }
    },
    [toast],
  );

  const call = React.useCallback(
    async (phone: string) => {
      const res = await placeCall(phone);
      toast(
        res.success
          ? { title: "Calling…", description: phone }
          : { title: "Could not call", description: res.error, variant: "destructive" },
      );
    },
    [toast],
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Relationships — never lose touch</PageTitle>
          <PageDescription>
            Keep important people warm. Set a cadence and SabCall surfaces
            contacts you haven&apos;t reached in time — call them or mark them
            touched in one tap.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          <HeartHandshake className="h-4 w-4" aria-hidden /> Touch cadence
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Automation">
            <SelectField
              value={settings.enabled ? "on" : "off"}
              onChange={(v) => setSettings((s) => ({ ...s, enabled: v === "on" }))}
              options={[
                { value: "on", label: "Enabled" },
                { value: "off", label: "Disabled" },
              ]}
            />
          </Field>
          <Field label="Reach every (days)">
            <Input
              type="number"
              value={String(settings.cadenceDays)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, cadenceDays: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="Audience">
            <SelectField
              value={settings.scope}
              onChange={(v) => setSettings((s) => ({ ...s, scope: v === "all" ? "all" : "vip" }))}
              options={[
                { value: "vip", label: "VIP contacts" },
                { value: "all", label: "All contacts" },
              ]}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={() => void save()} className="sc-press">
            Save cadence
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--st-text-secondary)]">Due to reach</h2>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : due.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<HeartHandshake aria-hidden />}
              title="Everyone's warm"
              description="No contacts are overdue for a touch right now."
            />
          </Card>
        ) : (
          <ul className="sc-stagger flex flex-col gap-2">
            {due.map((c, i) => (
              <li
                key={c._id}
                className="sc-stagger-item"
                style={{ ["--sc-i" as string]: i } as React.CSSProperties}
              >
                <Card className="sc-card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--st-text)]">
                      {c.name || c.phone}
                      {c.company ? (
                        <span className="text-[var(--st-text-secondary)]"> · {c.company}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--st-text-secondary)]">{c.phone}</div>
                  </div>
                  <Badge variant="outline">{sinceLabel(c.lastTouchedAt)}</Badge>
                  <Button size="sm" variant="outline" iconLeft={Phone} onClick={() => void call(c.phone)} className="sc-press">
                    Call
                  </Button>
                  <Button size="sm" variant="ghost" iconLeft={Check} onClick={() => void touch(c._id)} className="sc-press">
                    Touched
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
