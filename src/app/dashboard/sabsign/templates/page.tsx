'use client';

/**
 * Templates list + instantiate dialog.
 *
 * A template is a reusable envelope skeleton. Instantiating spawns a new
 * draft envelope with the supplied signers filling the template's
 * recipient slots.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Send, ArrowLeft } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/zoruui';
import {
  deleteTemplate,
  instantiateTemplate,
  listTemplates,
} from '@/app/actions/esign.actions';
import type { EsignTemplateDoc } from '@/lib/rust-client/esign-templates';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<EsignTemplateDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [instantiating, setInstantiating] = React.useState<EsignTemplateDoc | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTemplates({ q: search || undefined, limit: 100 });
      setTemplates(res.items);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this template?')) return;
    await deleteTemplate(id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/sabsign">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-zoru-ink">Templates</h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/sabsign/new?template=1">
            <Plus className="h-4 w-4 mr-2" />
            New template
          </Link>
        </Button>
      </div>

      <Input
        placeholder="Search templates…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-sm text-zoru-ink-muted">Loading…</div>
      ) : templates.length === 0 ? (
        <Card className="p-8 border border-dashed border-zoru-line text-center text-sm text-zoru-ink-muted">
          No templates yet. Save an existing envelope as a template from the envelope detail page.
        </Card>
      ) : (
        <Card className="p-0 border border-zoru-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zoru-surface-2">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Recipients</th>
                <th className="px-3 py-2 text-left">Fields</th>
                <th className="px-3 py-2 text-left">Routing</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t._id} className="border-t border-zoru-line">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2">{t.recipientSlots.length}</td>
                  <td className="px-3 py-2">{t.fields.length}</td>
                  <td className="px-3 py-2 text-zoru-ink-muted">{t.routingOrder}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button size="sm" onClick={() => setInstantiating(t)}>
                      <Send className="h-3 w-3 mr-1" />
                      Use
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => handleDelete(t._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {instantiating && (
        <InstantiateDialog
          template={instantiating}
          onClose={() => setInstantiating(null)}
          onCreated={(envelopeId) => {
            setInstantiating(null);
            router.push(`/dashboard/sabsign/${envelopeId}`);
          }}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

interface InstantiateDialogProps {
  template: EsignTemplateDoc;
  onClose: () => void;
  onCreated: (envelopeId: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}

function InstantiateDialog({ template, onClose, onCreated, busy, setBusy }: InstantiateDialogProps) {
  const [signers, setSigners] = React.useState(
    template.recipientSlots.map((slot) => ({
      slot,
      name: '',
      email: '',
      phone: '',
    })),
  );

  const submit = async () => {
    setBusy(true);
    try {
      const res = await instantiateTemplate(template._id, {
        envelopeName: `${template.name} — ${new Date().toLocaleDateString()}`,
        signers: signers.map((s, i) => ({
          id: `s_${i}`,
          role: s.slot.role,
          name: s.name,
          email: s.email,
          phone: s.phone || undefined,
          authMethod: (s.slot.authMethod as 'email' | 'sms_otp' | 'kba' | 'pin') || 'email',
          order: s.slot.order,
          status: 'pending' as const,
        })),
      });
      onCreated(res.envelopeId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use template: {template.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {signers.map((s, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2 text-sm font-medium">
                {s.slot.label} <Badge variant="outline">{s.slot.role}</Badge>
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={s.name}
                  onChange={(e) => {
                    const out = [...signers];
                    out[i] = { ...out[i], name: e.target.value };
                    setSigners(out);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={s.email}
                  onChange={(e) => {
                    const out = [...signers];
                    out[i] = { ...out[i], email: e.target.value };
                    setSigners(out);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || signers.some((s) => !s.name || !s.email)}
            onClick={submit}
          >
            Create envelope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
