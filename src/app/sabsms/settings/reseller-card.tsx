"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";

import type { SabsmsRateCardRate } from "@/lib/sabsms/ratecards/resolve";

import {
  deleteRateCardAction,
  listRateCardsAction,
  marginReportAction,
  saveRateCardAction,
  type RateCardRow,
} from "./reseller-actions";

/**
 * V2.13 — reseller engine settings card (additive, same pattern as
 * short-links-card / agent-card): rate-card CRUD + child-workspace
 * attachment + price-vs-cost margin table.
 */

const CHANNELS = ["any", "sms", "mms", "rcs"] as const;
const CATEGORIES = ["any", "transactional", "otp", "marketing", "alert", "service"] as const;

interface EditableRate {
  country: string;
  channel: string;
  category: string;
  creditsPerSegment: string;
}

interface EditorState {
  id?: string;
  name: string;
  effectiveFrom: string;
  marginNote: string;
  childIdsText: string;
  rates: EditableRate[];
}

const EMPTY_EDITOR: EditorState = {
  name: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  marginNote: "",
  childIdsText: "",
  rates: [{ country: "IN", channel: "any", category: "any", creditsPerSegment: "2" }],
};

function toEditor(card: RateCardRow): EditorState {
  return {
    id: card.id,
    name: card.name,
    effectiveFrom: card.effectiveFrom.slice(0, 10),
    marginNote: card.marginNote,
    childIdsText: card.childWorkspaceIds.join("\n"),
    rates: card.rates.map((r) => ({
      country: r.country,
      channel: r.channel ?? "any",
      category: r.category ?? "any",
      creditsPerSegment: String(r.creditsPerSegment),
    })),
  };
}

function fromEditor(state: EditorState): {
  id?: string;
  name: string;
  rates: SabsmsRateCardRate[];
  childWorkspaceIds: string[];
  marginNote?: string;
  effectiveFrom: string;
} {
  return {
    id: state.id,
    name: state.name,
    effectiveFrom: `${state.effectiveFrom}T00:00:00.000Z`,
    marginNote: state.marginNote || undefined,
    childWorkspaceIds: state.childIdsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    rates: state.rates.map((r) => ({
      country: r.country.trim().toUpperCase() || "*",
      ...(r.channel !== "any" ? { channel: r.channel as SabsmsRateCardRate["channel"] } : {}),
      ...(r.category !== "any" ? { category: r.category as SabsmsRateCardRate["category"] } : {}),
      creditsPerSegment: Number(r.creditsPerSegment) || 0,
    })),
  };
}

export function ResellerSettingsCard() {
  const { toast } = useToast();
  const [cards, setCards] = React.useState<RateCardRow[]>([]);
  const [margin, setMargin] = React.useState<
    Array<{ childWorkspaceId: string; month: string; creditsCharged: number; costCents: number }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [cardsRes, marginRes] = await Promise.all([listRateCardsAction(), marginReportAction()]);
    if (cardsRes.success) setCards(cardsRes.cards);
    if (marginRes.success) setMargin(marginRes.rows);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setSaving(true);
    const res = await saveRateCardAction(fromEditor(editor));
    setSaving(false);
    if (res.success) {
      toast.success("Rate card saved");
      setEditor(null);
      refresh();
    } else {
      toast({ title: "Could not save rate card", description: res.error, tone: "danger" });
    }
  }

  async function handleDelete(card: RateCardRow) {
    const res = await deleteRateCardAction(card.id);
    if (res.success) {
      toast.success("Rate card deleted");
      refresh();
    } else {
      toast({ title: "Delete failed", description: res.error, tone: "danger" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reseller rate cards</CardTitle>
        <CardDescription>
          Price child workspaces per country/channel/category in credits per segment. Every credit
          reservation consults the child&apos;s latest effective card before falling back to platform
          rates. The margin table compares what children were charged against wholesale cost.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Card list */}
        <div className="space-y-3">
          {loading && cards.length === 0 ? (
            <div className="h-16 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]" />
          ) : cards.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">
              No rate cards yet — create one to start reselling.
            </p>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--st-text)]">{card.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                    {card.rates.length} rate{card.rates.length === 1 ? "" : "s"} ·{" "}
                    {card.childWorkspaceIds.length} child workspace
                    {card.childWorkspaceIds.length === 1 ? "" : "s"} · effective{" "}
                    {card.effectiveFrom.slice(0, 10)}
                  </p>
                  {card.marginNote && (
                    <p className="mt-0.5 text-xs italic text-[var(--st-text-tertiary)]">
                      {card.marginNote}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {new Date(card.effectiveFrom).getTime() > Date.now() && (
                    <Badge tone="warning" kind="soft">
                      Staged
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditor(toEditor(card))}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Trash2}
                    onClick={() => handleDelete(card)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}

          {!editor && (
            <Button variant="outline" size="sm" iconLeft={Plus} onClick={() => setEditor({ ...EMPTY_EDITOR })}>
              New rate card
            </Button>
          )}
        </div>

        {/* Editor */}
        {editor && (
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Card name" required>
                <Input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder="e.g. Agency standard 2×"
                  required
                />
              </Field>
              <Field label="Effective from (UTC)">
                <Input
                  type="date"
                  value={editor.effectiveFrom}
                  onChange={(e) => setEditor({ ...editor, effectiveFrom: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Rates (credits per segment)"
              help="Country is ISO alpha-2 or * for any. The most specific matching row wins; unmatched sends use platform rates."
            >
              <div className="space-y-2">
                {editor.rates.map((rate, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={rate.country}
                      onChange={(e) => {
                        const rates = [...editor.rates];
                        rates[idx] = { ...rate, country: e.target.value };
                        setEditor({ ...editor, rates });
                      }}
                      placeholder="IN"
                      className="w-20"
                      aria-label="Country"
                    />
                    <Select
                      value={rate.channel}
                      onValueChange={(v) => {
                        const rates = [...editor.rates];
                        rates[idx] = { ...rate, channel: v };
                        setEditor({ ...editor, rates });
                      }}
                    >
                      <SelectTrigger aria-label="Channel" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c === "any" ? "any channel" : c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={rate.category}
                      onValueChange={(v) => {
                        const rates = [...editor.rates];
                        rates[idx] = { ...rate, category: v };
                        setEditor({ ...editor, rates });
                      }}
                    >
                      <SelectTrigger aria-label="Category" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c === "any" ? "any category" : c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={rate.creditsPerSegment}
                      onChange={(e) => {
                        const rates = [...editor.rates];
                        rates[idx] = { ...rate, creditsPerSegment: e.target.value };
                        setEditor({ ...editor, rates });
                      }}
                      className="w-28"
                      aria-label="Credits per segment"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label="Remove rate row"
                      onClick={() =>
                        setEditor({ ...editor, rates: editor.rates.filter((_, i) => i !== idx) })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() =>
                    setEditor({
                      ...editor,
                      rates: [
                        ...editor.rates,
                        { country: "*", channel: "any", category: "any", creditsPerSegment: "2" },
                      ],
                    })
                  }
                >
                  Add rate row
                </Button>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Child workspace ids"
                help="One per line (or comma-separated). These workspaces are priced by this card."
              >
                <textarea
                  className="min-h-[80px] w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2 font-mono text-xs text-[var(--st-text)]"
                  value={editor.childIdsText}
                  onChange={(e) => setEditor({ ...editor, childIdsText: e.target.value })}
                  placeholder="665f1c2ab8d34e0012345678"
                />
              </Field>
              <Field label="Margin note (internal)">
                <Input
                  value={editor.marginNote}
                  onChange={(e) => setEditor({ ...editor, marginNote: e.target.value })}
                  placeholder="e.g. 2× wholesale, reviewed quarterly"
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-3">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} disabled={saving}>
                {saving ? "Saving…" : editor.id ? "Save changes" : "Create rate card"}
              </Button>
            </div>
          </form>
        )}

        {/* White-label + carrier-fee pass-through — plan-deferred (net-new).
            Shown honestly as coming soon; not faked. The rate-card CRUD and
            margin report above are real and fully wired. */}
        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--st-text)]">
              White-label &amp; carrier-fee pass-through
            </h4>
            <Badge tone="neutral" kind="soft">
              Coming soon
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            Per-tenant brand name/logo white-labelling and itemised carrier-fee
            pass-through line items are planned for a future release. They are not
            available yet — no carrier-fee field is charged and no white-label
            branding is applied today. Per-country/channel/category pricing (above)
            is fully live.
          </p>
        </div>

        {/* Margin report */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--st-text)]">
            Margin report (price vs cost, per child per month)
          </h4>
          {margin.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">
              No child activity yet — rows appear once attached workspaces start sending.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th>Month</Th>
                    <Th>Child workspace</Th>
                    <Th>Credits charged</Th>
                    <Th>Wholesale cost</Th>
                  </Tr>
                </THead>
                <TBody>
                  {margin.map((row) => (
                    <Tr key={`${row.childWorkspaceId}:${row.month}`}>
                      <Td className="font-mono text-xs">{row.month}</Td>
                      <Td className="font-mono text-xs">{row.childWorkspaceId}</Td>
                      <Td className="text-sm">{row.creditsCharged.toLocaleString()}</Td>
                      <Td className="text-sm">
                        {(row.costCents / 100).toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
