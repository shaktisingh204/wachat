'use client';

/**
 * Signers + routing editor.
 *
 * Per-signer auth tier is chosen here:
 *   * email        — token in the URL is sufficient
 *   * sms_otp      — code dispatched to phone before sign action
 *   * kba          — 1+ knowledge questions; answers hashed at create time
 *   * pin          — kiosk/in-person mode (PIN is set via kiosk link flow)
 */

import * as React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, ShieldAlert } from 'lucide-react';
import { Button, Input, Label, Card, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea, Badge } from '@/components/sabcrm/20ui/compat';
import type { AuthMethod, EnvelopeSigner, RoutingOrder } from '@/lib/rust-client/esign-envelopes';

const AUTH_METHODS: Array<{ value: AuthMethod; label: string; help: string }> = [
  { value: 'email', label: 'Email link', help: 'Per-signer URL token only.' },
  { value: 'sms_otp', label: 'SMS OTP', help: 'Require a 6-digit code over SMS.' },
  { value: 'kba', label: 'KBA', help: 'Knowledge-based questions.' },
  { value: 'pin', label: 'In-person PIN', help: 'Kiosk / on-device PIN.' },
];

export interface SignersEditorProps {
  signers: EnvelopeSigner[];
  routingOrder: RoutingOrder;
  onSignersChange: (signers: EnvelopeSigner[]) => void;
  onRoutingChange: (order: RoutingOrder) => void;
}

let nextLocalId = 1;

export function SignersEditor({
  signers,
  routingOrder,
  onSignersChange,
  onRoutingChange,
}: SignersEditorProps) {
  const updateSigner = (id: string, patch: Partial<EnvelopeSigner>) => {
    onSignersChange(signers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSigner = () => {
    const order = signers.length + 1;
    const role = `signer_${order}`;
    onSignersChange([
      ...signers,
      {
        id: `local_${nextLocalId++}`,
        role,
        name: '',
        email: '',
        authMethod: 'email',
        order,
        status: 'pending',
      },
    ]);
  };

  const removeSigner = (id: string) => {
    onSignersChange(
      signers
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, order: idx + 1 })),
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = signers.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= signers.length) return;
    const out = [...signers];
    [out[i], out[j]] = [out[j], out[i]];
    onSignersChange(out.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-[var(--st-border)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-medium text-[var(--st-text)]">Routing</h4>
            <p className="text-xs text-[var(--st-text-secondary)]">
              How signers are notified and ordered.
            </p>
          </div>
          <div className="flex gap-2">
            {(['sequential', 'parallel', 'conditional'] as RoutingOrder[]).map((o) => (
              <Button
                key={o}
                size="sm"
                variant={routingOrder === o ? 'default' : 'outline'}
                onClick={() => onRoutingChange(o)}
              >
                {o}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {signers.map((s, idx) => (
        <Card key={s.id} className="p-4 border border-[var(--st-border)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--st-text)]">
              #{idx + 1} — {s.role}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => move(s.id, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => move(s.id, 1)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-text)]/10"
                onClick={() => removeSigner(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={s.name}
                onChange={(e) => updateSigner(s.id, { name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={s.email}
                onChange={(e) => updateSigner(s.id, { email: e.target.value })}
              />
            </div>
            <div>
              <Label>Recipient Type</Label>
              <Select value={s.role.includes('_') ? 'signer' : s.role} onValueChange={(val) => updateSigner(s.id, { role: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signer">Needs to Sign</SelectItem>
                  <SelectItem value="approver">Needs to Approve</SelectItem>
                  <SelectItem value="cc">Receives a Copy (CC)</SelectItem>
                  <SelectItem value="witness">Witness</SelectItem>
                  <SelectItem value="notary">Notary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone (for SMS OTP)</Label>
              <Input
                value={s.phone || ''}
                onChange={(e) => updateSigner(s.id, { phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Authentication & Security</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {AUTH_METHODS.map((m) => (
                  <Button
                    key={m.value}
                    size="sm"
                    type="button"
                    variant={s.authMethod === m.value ? 'default' : 'outline'}
                    onClick={() => updateSigner(s.id, { authMethod: m.value })}
                    title={m.help}
                  >
                    {m.value !== 'email' && <ShieldAlert className="w-3 h-3 mr-1 opacity-70" />}
                    {m.label}
                  </Button>
                ))}
              </div>
              {s.authMethod === 'kba' && (
                <KbaEditor
                  questions={s.kbaQuestions || []}
                  onChange={(questions) => updateSigner(s.id, { kbaQuestions: questions })}
                />
              )}
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-[var(--st-border)]">
              <Label className="flex items-center gap-1"><Mail className="w-4 h-4 text-[var(--st-text-secondary)]" /> Private Message</Label>
              <Textarea 
                className="mt-1" 
                placeholder={`Optional private message for ${s.name || 'this recipient'} only...`} 
              />
            </div>
          </div>
        </Card>
      ))}

      <Button variant="outline" onClick={addSigner}>
        <Plus className="h-4 w-4 mr-2" />
        Add signer
      </Button>
    </div>
  );
}

interface KbaEditorProps {
  questions: Array<{ question: string; answerHash: string }>;
  onChange: (q: Array<{ question: string; answerHash: string }>) => void;
}

/**
 * KBA editor — hashes the answer client-side via SubtleCrypto before
 * stashing on the signer record. The cleartext answer never leaves the
 * sender's browser.
 */
function KbaEditor({ questions, onChange }: KbaEditorProps) {
  async function sha256(s: string): Promise<string> {
    const data = new TextEncoder().encode(s.trim().toLowerCase());
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const addQ = () => onChange([...questions, { question: '', answerHash: '' }]);
  const removeQ = (i: number) => onChange(questions.filter((_, idx) => idx !== i));

  return (
    <div className="mt-3 space-y-2 border border-[var(--st-border)] rounded-md p-3">
      <div className="text-xs text-[var(--st-text-secondary)]">
        Answers are hashed client-side; cleartext is never stored.
      </div>
      {questions.map((q, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            placeholder="Question"
            value={q.question}
            onChange={(e) => {
              const out = [...questions];
              out[i] = { ...out[i], question: e.target.value };
              onChange(out);
            }}
          />
          <Input
            placeholder="Expected answer"
            onChange={async (e) => {
              const h = await sha256(e.target.value);
              const out = [...questions];
              out[i] = { ...out[i], answerHash: h };
              onChange(out);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-[var(--st-text)]"
            onClick={() => removeQ(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addQ}>
        <Plus className="h-3 w-3 mr-1" />
        Add question
      </Button>
    </div>
  );
}
