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
import { ArrowLeft, Plus, Send, Trash2, Eye, Braces } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
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
    return <Skeleton height={384} className="w-full" />;
  }

  return (
    <div className="ui20 space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            {mode === 'create' ? 'New transactional template' : `Edit: ${name || 'Template'}`}
          </PageTitle>
          <PageDescription>
            Define a key, declare merge variables, and write the HTML body. The key is what
            dispatching code uses to address this template.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={ArrowLeft} onClick={() => router.back()}>
            Back
          </Button>
          <Button variant="primary" onClick={handleSave} loading={pending}>
            Save
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="Key"
              help="Lowercase identifier; used by dispatchers. Must be unique per workspace."
            >
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                placeholder="order_confirmation"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="From name">
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </Field>
              <Field label="From email">
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Reply-to">
              <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
            </Field>
          </CardBody>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Preheader">
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
            </Field>
            <Field label="HTML body">
              <Textarea
                rows={10}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
              />
            </Field>
            <Field label="Plain-text body (optional)">
              <Textarea
                rows={4}
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Variables schema</CardTitle>
            <CardDescription>
              Declare merge variables referenced in the body via {'{{name}}'}.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={() =>
              setVars((prev) => [
                ...prev,
                { name: '', kind: 'string', required: false },
              ])
            }
          >
            Add variable
          </Button>
        </CardHeader>
        <CardBody>
          <Separator />
          {vars.length === 0 ? (
            <EmptyState
              icon={Braces}
              title="No variables declared"
              description="Add a variable to merge dynamic values into the subject and body."
              size="sm"
              className="py-6"
            />
          ) : (
            <div className="space-y-2 pt-4">
              {vars.map((v, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <Input
                    className="col-span-3"
                    placeholder="firstName"
                    aria-label={`Variable ${idx + 1} name`}
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
                      <SelectTrigger aria-label={`Variable ${idx + 1} kind`}>
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
                    aria-label={`Variable ${idx + 1} default`}
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
                    aria-label={`Variable ${idx + 1} description`}
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
                      aria-label={`Variable ${idx + 1} required`}
                      checked={v.required ?? false}
                      onChange={(e) =>
                        setVars((prev) => {
                          const copy = prev.slice();
                          copy[idx] = { ...copy[idx], required: e.target.checked };
                          return copy;
                        })
                      }
                    />
                    <IconButton
                      label="Remove variable"
                      icon={Trash2}
                      variant="ghost"
                      onClick={() =>
                        setVars((prev) => {
                          const copy = prev.slice();
                          copy.splice(idx, 1);
                          return copy;
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {mode === 'edit' && (
        <Card padding="lg">
          <CardHeader className="flex items-center justify-between gap-4">
            <CardTitle>Live preview &amp; test send</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" iconLeft={Eye} onClick={handlePreview} loading={pending}>
                Render
              </Button>
              <Button variant="primary" iconLeft={Send} onClick={handleTestSend} loading={pending}>
                Test send
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <Separator />
            <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--st-text)]">Variables payload</p>
                {declaredNames.length === 0 ? (
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Declare variables above to render with merge values.
                  </p>
                ) : (
                  declaredNames.map((n) => (
                    <Field key={n} label={n} className="flex-row items-center gap-2">
                      <Input
                        value={previewVars[n] ?? ''}
                        onChange={(e) =>
                          setPreviewVars((prev) => ({ ...prev, [n]: e.target.value }))
                        }
                      />
                    </Field>
                  ))
                )}
                <Separator />
                <Field label="Test recipients">
                  <Input
                    placeholder="alice@example.com, bob@example.com"
                    value={testEmails}
                    onChange={(e) => setTestEmails(e.target.value)}
                  />
                </Field>
                {missing.length > 0 && (
                  <p className="text-xs text-[var(--st-danger)]">
                    Missing variables: {missing.join(', ')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--st-text)]">Rendered subject</p>
                <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-medium text-[var(--st-text)]">
                  {previewSubject || <Badge variant="outline">Render to see output</Badge>}
                </div>
                <p className="text-sm font-medium text-[var(--st-text)]">Rendered HTML</p>
                <iframe
                  title="Transactional preview"
                  srcDoc={previewHtml || '<p>Render to see output.</p>'}
                  className="h-80 w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-white"
                  sandbox=""
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
