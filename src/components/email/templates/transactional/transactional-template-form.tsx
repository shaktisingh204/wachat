'use client';

/**
 * Transactional-template create/edit form.
 *
 * Renders a name + key + subject + body editor alongside a variables
 * schema editor (rows of name / kind / required / default). The form
 * also drives live preview via the `preview` server action.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Send, Trash2, Eye } from 'lucide-react';
import { Badge, Button, Card, Checkbox, Input, Label, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Skeleton, Textarea, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionCreateTransactionalTemplate,
  actionGetTransactionalTemplate,
  actionPreviewTransactionalTemplate,
  actionTestSendTransactionalTemplate,
  actionUpdateTransactionalTemplate,
} from '@/app/actions/email/templates-transactional.actions';
import type {
  TransactionalTemplateDoc,
  TransactionalVarKind,
  TransactionalVarSchemaEntry,
} from '@/lib/rust-client/email-templates-transactional';

interface Props {
  mode: 'create' | 'edit';
  templateId?: string;
}

const KIND_OPTIONS: TransactionalVarKind[] = ['string', 'number', 'boolean', 'date'];

export function TransactionalTemplateForm({ mode, templateId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(mode === 'edit');

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [htmlBody, setHtmlBody] = useState('<h1>Hi {{firstName}},</h1>\n<p>Your order #{{orderId}} is confirmed.</p>');
  const [textBody, setTextBody] = useState('');
  const [vars, setVars] = useState<TransactionalVarSchemaEntry[]>([]);

  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [missing, setMissing] = useState<string[]>([]);
  const [testEmails, setTestEmails] = useState('');

  useEffect(() => {
    if (mode === 'edit' && templateId) {
      (async () => {
        const r = await actionGetTransactionalTemplate(templateId);
        if (r.ok) {
          const t = r.data as TransactionalTemplateDoc;
          setName(t.name);
          setKey(t.key);
          setSubject(t.subject);
          setPreheader(t.preheader ?? '');
          setFromName(t.fromName ?? '');
          setFromEmail(t.fromEmail ?? '');
          setReplyTo(t.replyTo ?? '');
          setHtmlBody(t.htmlBody);
          setTextBody(t.textBody ?? '');
          setVars(t.vars ?? []);
        } else {
          toast.error(r.error);
        }
        setLoading(false);
      })();
    }
  }, [mode, templateId]);

  const handleSave = useCallback(() => {
    if (!name.trim() || !key.trim() || !subject.trim() || !htmlBody.trim()) {
      toast.error('Name, key, subject and body are required');
      return;
    }
    startTransition(async () => {
      if (mode === 'create') {
        const r = await actionCreateTransactionalTemplate({
          name,
          key,
          subject,
          preheader: preheader || undefined,
          fromName: fromName || undefined,
          fromEmail: fromEmail || undefined,
          replyTo: replyTo || undefined,
          htmlBody,
          textBody: textBody || undefined,
          vars,
        });
        if (r.ok) {
          toast.success('Template created');
          router.push(`/dashboard/email/templates/transactional/${r.data._id}`);
        } else {
          toast.error(r.error);
        }
      } else if (templateId) {
        const r = await actionUpdateTransactionalTemplate(templateId, {
          name,
          key,
          subject,
          preheader: preheader || undefined,
          fromName: fromName || undefined,
          fromEmail: fromEmail || undefined,
          replyTo: replyTo || undefined,
          htmlBody,
          textBody: textBody || undefined,
          vars,
        });
        if (r.ok) {
          toast.success('Template saved');
        } else {
          toast.error(r.error);
        }
      }
    });
  }, [
    fromEmail, fromName, htmlBody, key, mode, name, preheader, replyTo,
    router, subject, templateId, textBody, vars,
  ]);

  const handlePreview = useCallback(() => {
    if (!templateId) {
      toast.error('Save before previewing');
      return;
    }
    startTransition(async () => {
      const r = await actionPreviewTransactionalTemplate(templateId, previewVars);
      if (r.ok) {
        setPreviewHtml(r.data.html);
        setPreviewSubject(r.data.subject);
        setMissing(r.data.missingVars);
      } else {
        toast.error(r.error);
      }
    });
  }, [previewVars, templateId]);

  const handleTestSend = useCallback(() => {
    if (!templateId) {
      toast.error('Save before sending a test');
      return;
    }
    const toEmails = testEmails
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (toEmails.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    startTransition(async () => {
      const r = await actionTestSendTransactionalTemplate(templateId, toEmails, previewVars);
      if (r.ok) {
        toast.success(r.data.note ?? `Queued ${r.data.queued} test sends`);
      } else {
        toast.error(r.error);
      }
    });
  }, [previewVars, templateId, testEmails]);

  // Keep previewVars keys in sync with declared `vars`.
  const declaredNames = useMemo(() => vars.map((v) => v.name), [vars]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            {mode === 'create' ? 'New transactional template' : `Edit: ${name || 'Template'}`}
          </PageTitle>
          <PageDescription>
            Define a `key`, declare merge variables, and write the HTML body. The key is what
            dispatching code uses to address this template.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            Save
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold">Identity</h2>
          <div className="space-y-2">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-key">Key</Label>
            <Input
              id="t-key"
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/[^a-z0-9_]/g, ''))}
              placeholder="order_confirmation"
            />
            <p className="text-xs text-[color:var(--st-text-secondary)]">
              Lowercase identifier; used by dispatchers. Must be unique per workspace.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="t-from-name">From name</Label>
              <Input id="t-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-from-email">From email</Label>
              <Input
                id="t-from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-reply-to">Reply-to</Label>
            <Input id="t-reply-to" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold">Content</h2>
          <div className="space-y-2">
            <Label htmlFor="t-subject">Subject</Label>
            <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-preheader">Preheader</Label>
            <Input id="t-preheader" value={preheader} onChange={(e) => setPreheader(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-html">HTML body</Label>
            <Textarea
              id="t-html"
              rows={10}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-text">Plain-text body (optional)</Label>
            <Textarea
              id="t-text"
              rows={4}
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
            />
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Variables schema</h2>
            <p className="text-sm text-[color:var(--st-text-secondary)]">
              Declare merge variables referenced in the body via `{`{{name}}`}`.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVars((prev) => [
                ...prev,
                { name: '', kind: 'string', required: false },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add variable
          </Button>
        </div>
        <Separator />
        {vars.length === 0 ? (
          <p className="text-sm text-[color:var(--st-text-secondary)]">No variables declared.</p>
        ) : (
          <div className="space-y-2">
            {vars.map((v, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-3"
                  placeholder="firstName"
                  value={v.name}
                  onChange={(e) =>
                    setVars((prev) => {
                      const copy = prev.slice();
                      copy[idx] = { ...copy[idx], name: e.target.value };
                      return copy;
                    })
                  }
                />
                <div className="col-span-2">
                  <Select
                    value={v.kind}
                    onValueChange={(val) =>
                      setVars((prev) => {
                        const copy = prev.slice();
                        copy[idx] = { ...copy[idx], kind: val as TransactionalVarKind };
                        return copy;
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="col-span-3"
                  placeholder="default value"
                  value={typeof v.default === 'string' ? v.default : ''}
                  onChange={(e) =>
                    setVars((prev) => {
                      const copy = prev.slice();
                      copy[idx] = { ...copy[idx], default: e.target.value };
                      return copy;
                    })
                  }
                />
                <Input
                  className="col-span-3"
                  placeholder="description"
                  value={v.description ?? ''}
                  onChange={(e) =>
                    setVars((prev) => {
                      const copy = prev.slice();
                      copy[idx] = { ...copy[idx], description: e.target.value };
                      return copy;
                    })
                  }
                />
                <div className="col-span-1 flex items-center gap-2">
                  <Checkbox
                    id={`var-req-${idx}`}
                    checked={v.required ?? false}
                    onCheckedChange={(b) =>
                      setVars((prev) => {
                        const copy = prev.slice();
                        copy[idx] = { ...copy[idx], required: !!b };
                        return copy;
                      })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setVars((prev) => {
                        const copy = prev.slice();
                        copy.splice(idx, 1);
                        return copy;
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {mode === 'edit' && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Live preview &amp; test send</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreview} disabled={pending}>
                <Eye className="mr-2 h-4 w-4" />
                Render
              </Button>
              <Button onClick={handleTestSend} disabled={pending}>
                <Send className="mr-2 h-4 w-4" />
                Test send
              </Button>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Variables payload</Label>
              {declaredNames.length === 0 ? (
                <p className="text-sm text-[color:var(--st-text-secondary)]">
                  Declare variables above to render with merge values.
                </p>
              ) : (
                declaredNames.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <Label className="w-32 text-xs" htmlFor={`pv-${n}`}>
                      {n}
                    </Label>
                    <Input
                      id={`pv-${n}`}
                      value={previewVars[n] ?? ''}
                      onChange={(e) =>
                        setPreviewVars((prev) => ({ ...prev, [n]: e.target.value }))
                      }
                    />
                  </div>
                ))
              )}
              <Separator />
              <Label htmlFor="test-emails">Test recipients</Label>
              <Input
                id="test-emails"
                placeholder="alice@example.com, bob@example.com"
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
              />
              {missing.length > 0 && (
                <div className="text-xs text-[color:var(--st-danger)]">
                  Missing variables: {missing.join(', ')}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Rendered subject</Label>
              <div className="rounded border bg-[color:var(--st-bg)] p-3 font-medium">
                {previewSubject || <Badge variant="outline">Render to see output</Badge>}
              </div>
              <Label>Rendered HTML</Label>
              <iframe
                title="Transactional preview"
                srcDoc={previewHtml || '<p>Render to see output.</p>'}
                className="h-80 w-full rounded border bg-white"
                sandbox=""
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
