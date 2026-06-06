'use client';

/**
 * New envelope builder.
 *
 * Single-page workflow (no tabs — see ZoruUI no-tab directive):
 *   1. Pick a SabFiles document.
 *   2. Add signers + auth tiers.
 *   3. (Optional) configure conditional routing rules.
 *   4. Drag/drop fields on the PDF preview.
 *   5. Save as draft, then explicitly Send.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, ArrowLeft, Settings2 } from 'lucide-react';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Switch
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton } from '@/components/sabfiles';
import type { SabFilePick } from '@/components/sabfiles';
import {
  createEnvelope,
  sendEnvelope,
} from '@/app/actions/sabsign.actions';
import type {
  EnvelopeField,
  EnvelopeSigner,
  RoutingOrder,
  RoutingRule,
} from '@/lib/rust-client/esign-envelopes';

import { PdfFieldOverlay } from '../_components/pdf-field-overlay';
import { SignersEditor } from '../_components/signers-editor';
import { RoutingRulesEditor } from '../_components/routing-rules-editor';

export default function NewEnvelopePage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [subject, setSubject] = React.useState('Please sign this document');
  const [message, setMessage] = React.useState('');
  const [doc, setDoc] = React.useState<SabFilePick | null>(null);
  const [signers, setSigners] = React.useState<EnvelopeSigner[]>([]);
  const [fields, setFields] = React.useState<EnvelopeField[]>([]);
  const [routingOrder, setRoutingOrder] = React.useState<RoutingOrder>('sequential');
  const [routingRules, setRoutingRules] = React.useState<RoutingRule[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Advanced Options state
  const [remindersEnabled, setRemindersEnabled] = React.useState(false);
  const [reminderDays, setReminderDays] = React.useState(3);
  const [expireEnabled, setExpireEnabled] = React.useState(false);
  const [expireDays, setExpireDays] = React.useState(30);

  const roles = React.useMemo(
    () => Array.from(new Set(signers.map((s) => s.role).filter(Boolean))),
    [signers],
  );

  const canSave =
    name.trim().length > 0 &&
    doc !== null &&
    signers.length > 0 &&
    signers.every((s) => s.name && s.email);

  const handleSave = async (alsoSend: boolean) => {
    if (!canSave || !doc) return;
    setSaving(true);
    try {
      const res = await createEnvelope({
        name: name.trim(),
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
        docId: doc.id,
        docUrl: doc.url,
        docName: doc.name,
        routingOrder,
        routingRules,
        signers,
        fields,
        // Hypothetical new Rust backend params for the advanced settings:
        remindersEnabled,
        reminderDays,
        expireEnabled,
        expireDays,
      } as any); // Cast as any temporarily until Rust Client is updated
      if (alsoSend) {
        await sendEnvelope(res.id);
      }
      router.push(`/dashboard/sabsign/${res.id}`);
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-[var(--st-text)]">New envelope</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!canSave || saving}
            onClick={() => handleSave(false)}
          >
            <Save className="h-4 w-4 mr-2" />
            Save draft
          </Button>
          <Button disabled={!canSave || saving} onClick={() => handleSave(true)}>
            <Send className="h-4 w-4 mr-2" />
            Save and send
          </Button>
        </div>
      </div>

      <Card className="p-4 border border-[var(--st-border)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Envelope name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 Vendor Agreement" />
          </div>
          <div>
            <Label>Email subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Email message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Document</Label>
          <div className="flex items-center gap-3 mt-1">
            <SabFilePickerButton
              accept="document"
              onPick={(p) => setDoc(p)}
            >
              {doc ? 'Replace document' : 'Pick document from SabFiles'}
            </SabFilePickerButton>
            {doc && (
              <span className="text-sm text-[var(--st-text-secondary)]">{doc.name}</span>
            )}
          </div>
        </div>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border border-[var(--st-border)] rounded-xl bg-white px-4">
          <AccordionTrigger className="py-3 hover:no-underline text-sm font-medium text-[var(--st-text)]">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[var(--st-text-secondary)]" />
              Advanced Settings (Reminders & Expirations)
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-[var(--st-border)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Send automatic reminders</Label>
                  <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
                </div>
                {remindersEnabled && (
                  <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    Remind every <Input type="number" className="w-20 inline-flex" value={reminderDays} onChange={(e)=>setReminderDays(parseInt(e.target.value))} /> days
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Envelope expiration</Label>
                  <Switch checked={expireEnabled} onCheckedChange={setExpireEnabled} />
                </div>
                {expireEnabled && (
                  <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    Void after <Input type="number" className="w-20 inline-flex" value={expireDays} onChange={(e)=>setExpireDays(parseInt(e.target.value))} /> days
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="p-4 border border-[var(--st-border)]">
        <h3 className="text-sm font-medium text-[var(--st-text)] mb-3">Signers & Recipients</h3>
        <SignersEditor
          signers={signers}
          routingOrder={routingOrder}
          onSignersChange={setSigners}
          onRoutingChange={setRoutingOrder}
        />
      </Card>

      {routingOrder === 'conditional' && (
        <RoutingRulesEditor
          rules={routingRules}
          signers={signers}
          fields={fields}
          onChange={setRoutingRules}
        />
      )}

      {doc ? (
        <Card className="p-4 border border-[var(--st-border)]">
          <h3 className="text-sm font-medium text-[var(--st-text)] mb-3">
            Place fields on the document
          </h3>
          <PdfFieldOverlay
            docUrl={doc.url}
            recipientRoles={roles.length ? roles : ['signer']}
            fields={fields}
            onChange={setFields}
          />
        </Card>
      ) : (
        <Card className="p-8 border border-dashed border-[var(--st-border)] text-center text-sm text-[var(--st-text-secondary)]">
          Pick a document above to start placing signature fields.
        </Card>
      )}
    </div>
  );
}

