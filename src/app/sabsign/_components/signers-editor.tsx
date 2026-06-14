'use client';

/**
 * Signers + routing editor.
 *
 * Per-signer auth tier is chosen here:
 *   email     token in the URL is sufficient
 *   sms_otp   code dispatched to phone before sign action
 *   kba       1+ knowledge questions; answers hashed at create time
 *   pin       kiosk/in-person mode (PIN is set via kiosk link flow)
 */

import * as React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, ShieldAlert } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Field,
  Card,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  SegmentedControl,
} from '@/components/sabcrm/20ui';
import type {
  AuthMethod,
  EnvelopeSigner,
  KbaQuestion,
  RoutingOrder,
} from '@/lib/rust-client/sabsign-envelopes';

const ROUTING_ORDERS: Array<{ value: RoutingOrder; label: string }> = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'conditional', label: 'Conditional' },
];

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
      <Card variant="outlined">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-medium text-[var(--st-text)]">Routing</h4>
            <p className="text-xs text-[var(--st-text-secondary)]">
              How signers are notified and ordered.
            </p>
          </div>
          <SegmentedControl<RoutingOrder>
            aria-label="Routing order"
            items={ROUTING_ORDERS}
            value={routingOrder}
            onChange={onRoutingChange}
          />
        </div>
      </Card>

      {signers.map((s, idx) => (
        <Card key={s.id} variant="outlined">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--st-text)]">
              #{idx + 1}, {s.role}
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                size="sm"
                variant="ghost"
                icon={ChevronUp}
                label="Move signer up"
                onClick={() => move(s.id, -1)}
                disabled={idx === 0}
              />
              <IconButton
                size="sm"
                variant="ghost"
                icon={ChevronDown}
                label="Move signer down"
                onClick={() => move(s.id, 1)}
                disabled={idx === signers.length - 1}
              />
              <IconButton
                size="sm"
                variant="danger"
                icon={Trash2}
                label="Remove signer"
                onClick={() => removeSigner(s.id)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <Input
                value={s.name}
                onChange={(e) => updateSigner(s.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={s.email}
                onChange={(e) => updateSigner(s.id, { email: e.target.value })}
              />
            </Field>
            <Field label="Recipient type">
              <Select
                value={s.role.includes('_') ? 'signer' : s.role}
                onValueChange={(val) => updateSigner(s.id, { role: val })}
              >
                <SelectTrigger aria-label="Recipient type">
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
            </Field>
            <Field label="Phone (for SMS OTP)">
              <Input
                type="tel"
                value={s.phone || ''}
                onChange={(e) => updateSigner(s.id, { phone: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Authentication & security">
                <div className="flex flex-wrap gap-2">
                  {AUTH_METHODS.map((m) => (
                    <Button
                      key={m.value}
                      size="sm"
                      variant={s.authMethod === m.value ? 'primary' : 'outline'}
                      iconLeft={m.value !== 'email' ? ShieldAlert : undefined}
                      onClick={() => updateSigner(s.id, { authMethod: m.value })}
                      title={m.help}
                      aria-pressed={s.authMethod === m.value}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </Field>
              {s.authMethod === 'kba' && (
                <KbaEditor
                  questions={s.kbaQuestions || []}
                  onChange={(questions) => updateSigner(s.id, { kbaQuestions: questions })}
                />
              )}
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-[var(--st-border)]">
              <Field
                label={
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    Private message
                  </span>
                }
              >
                <Textarea
                  placeholder={`Optional private message for ${s.name || 'this recipient'} only...`}
                />
              </Field>
            </div>
          </div>
        </Card>
      ))}

      <Button variant="outline" iconLeft={Plus} onClick={addSigner}>
        Add signer
      </Button>
    </div>
  );
}

interface KbaEditorProps {
  questions: KbaQuestion[];
  onChange: (q: KbaQuestion[]) => void;
}

/**
 * KBA editor, hashes the answer client-side via SubtleCrypto before
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
    <div className="mt-3 space-y-2 border border-[var(--st-border)] rounded-[var(--st-radius)] p-3">
      <div className="text-xs text-[var(--st-text-secondary)]">
        Answers are hashed client-side; cleartext is never stored.
      </div>
      {questions.map((q, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
          <Input
            aria-label={`KBA question ${i + 1}`}
            placeholder="Question"
            value={q.question}
            onChange={(e) => {
              const out = [...questions];
              out[i] = { ...out[i], question: e.target.value };
              onChange(out);
            }}
          />
          <Input
            aria-label={`Expected answer for question ${i + 1}`}
            placeholder="Expected answer"
            onChange={async (e) => {
              const h = await sha256(e.target.value);
              const out = [...questions];
              out[i] = { ...out[i], answerHash: h };
              onChange(out);
            }}
          />
          <IconButton
            size="sm"
            variant="danger"
            icon={Trash2}
            label={`Remove question ${i + 1}`}
            onClick={() => removeQ(i)}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" iconLeft={Plus} onClick={addQ}>
        Add question
      </Button>
    </div>
  );
}
