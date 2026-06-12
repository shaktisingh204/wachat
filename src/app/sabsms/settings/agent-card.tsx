"use client";

/**
 * SabSMS settings — AI agent configuration card (V2.12).
 *
 * Same pattern as `short-links-card.tsx`: client card hydrated from a
 * server-loaded config, saving through an RBAC-gated server action.
 * Controls: enabled toggle, suggest/auto mode, persona + knowledge
 * textareas, max turns per conversation, handoff keyword chips.
 */

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tag,
  Textarea,
} from "@/components/sabcrm/20ui";

import {
  saveAgentConfigAction,
  type AgentConfigView,
} from "./agent-actions";

export function AgentSettingsCard({
  initialConfig,
}: {
  initialConfig: AgentConfigView;
}) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [mode, setMode] = useState<string>(initialConfig.mode);
  const [persona, setPersona] = useState(initialConfig.persona);
  const [knowledge, setKnowledge] = useState(initialConfig.knowledge);
  const [maxTurns, setMaxTurns] = useState(
    String(initialConfig.maxTurnsPerConversation),
  );
  const [keywords, setKeywords] = useState<string[]>(
    initialConfig.handoffKeywords,
  );
  const [keywordDraft, setKeywordDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addKeyword() {
    const k = keywordDraft.trim().toLowerCase();
    if (!k || keywords.includes(k)) {
      setKeywordDraft("");
      return;
    }
    setKeywords((prev) => [...prev, k]);
    setKeywordDraft("");
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await saveAgentConfigAction({
      enabled,
      mode,
      persona,
      knowledge,
      maxTurnsPerConversation: parseInt(maxTurns, 10) || 6,
      handoffKeywords: keywords,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setEnabled(res.config.enabled);
    setMode(res.config.mode);
    setPersona(res.config.persona);
    setKnowledge(res.config.knowledge);
    setMaxTurns(String(res.config.maxTurnsPerConversation));
    setKeywords(res.config.handoffKeywords);
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI agent</CardTitle>
        <CardDescription>
          The AI agent watches inbound replies. In <strong>suggest</strong>{" "}
          mode it drafts one-click replies in the inbox; in{" "}
          <strong>auto</strong> mode it answers on its own (each auto turn
          costs 1 credit). Replies always go through the same compliance,
          credit, and routing checks as human sends, and an opt-out
          classifier runs before the agent on every inbound.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="sabsms-agent-enabled"
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                setSaved(false);
              }}
            />
            <Label htmlFor="sabsms-agent-enabled" className="cursor-pointer">
              Enable the AI agent
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sabsms-agent-mode">Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => {
                  setMode(v);
                  setSaved(false);
                }}
              >
                <SelectTrigger id="sabsms-agent-mode" aria-label="Agent mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggest">
                    Suggest — drafts replies for one-click review
                  </SelectItem>
                  <SelectItem value="auto">
                    Auto — replies on its own (1 credit per turn)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sabsms-agent-max-turns">
                Max turns per conversation
              </Label>
              <Input
                id="sabsms-agent-max-turns"
                type="number"
                min="1"
                max="50"
                value={maxTurns}
                onChange={(e) => {
                  setMaxTurns(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sabsms-agent-persona">Persona</Label>
            <Textarea
              id="sabsms-agent-persona"
              rows={3}
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setSaved(false);
              }}
              placeholder="You are the friendly assistant for Acme Outdoor Gear. Be concise and helpful…"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sabsms-agent-knowledge">Knowledge base</Label>
            <Textarea
              id="sabsms-agent-knowledge"
              rows={6}
              value={knowledge}
              onChange={(e) => {
                setKnowledge(e.target.value);
                setSaved(false);
              }}
              placeholder={"Paste FAQs, store hours, return policy, product details…\n\nSeparate topics with blank lines."}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Plain text. The agent searches it per inbound message and only
              answers from what it finds.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sabsms-agent-keyword">Handoff keywords</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {keywords.map((k) => (
                <Tag
                  key={k}
                  onRemove={() => {
                    setKeywords((prev) => prev.filter((x) => x !== k));
                    setSaved(false);
                  }}
                  removeLabel={`Remove keyword ${k}`}
                >
                  {k}
                </Tag>
              ))}
              <Input
                id="sabsms-agent-keyword"
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="add keyword"
                inputSize="sm"
                className="w-36"
                aria-label="Add handoff keyword"
              />
              <Button type="button" size="sm" variant="ghost" onClick={addKeyword}>
                Add
              </Button>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              When an inbound message contains one of these words the agent
              hands the conversation to a human instead of replying.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {saved && <Badge variant="secondary">Saved</Badge>}
          </div>

          {error && (
            <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
              {error}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
