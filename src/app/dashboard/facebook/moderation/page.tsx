'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  Textarea,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { AlertCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteModerationRule,
  getModerationRules,
  saveModerationRule,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/moderation — Page-comment moderation rules.
 *
 * CRUD over moderation rules for the active project's Facebook Page via
 * `getModerationRules` / `saveModerationRule` / `deleteModerationRule`.
 * Each rule matches one or more keywords / patterns and applies an action
 * (hide, delete, flag) plus an optional auto-reply.
 */

import * as React from 'react';

type RuleAction = 'hide' | 'delete' | 'flag';

interface Rule {
  _id?: string;
  id?: string;
  name?: string;
  keywords?: string;
  pattern?: string;
  action?: string;
  autoReplyText?: string;
  isActive?: boolean;
}

const ACTION_OPTIONS: { value: RuleAction; label: string; tone: 'warning' | 'danger' | 'info' }[] = [
  { value: 'hide', label: 'Hide comment', tone: 'warning' },
  { value: 'delete', label: 'Delete comment', tone: 'danger' },
  { value: 'flag', label: 'Flag for review', tone: 'info' },
];

function getRuleId(r: Rule): string {
  return String(r._id ?? r.id ?? '');
}

function actionVariant(action?: string): 'warning' | 'danger' | 'info' | 'default' {
  const found = ACTION_OPTIONS.find((o) => o.value === action);
  return found?.tone ?? 'default';
}

export default function FacebookModerationPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [mutating, startMutating] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    keywords: string;
    action: RuleAction;
    autoReplyText: string;
    isActive: boolean;
  }>({ name: '', keywords: '', action: 'hide', autoReplyText: '', isActive: true });

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getModerationRules(projectId);
      if (res.error) {
        setError(res.error);
        setRules([]);
        return;
      }
      setError(null);
      setRules((res.rules as Rule[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = (ruleId?: string, overrides?: Partial<typeof form>) => {
    if (!projectId) return;
    const data = { ...form, ...overrides };
    if (!data.keywords.trim()) {
      zoruSonnerToast.error('Keywords / pattern is required.');
      return;
    }
    startMutating(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      if (ruleId) fd.set('ruleId', ruleId);
      fd.set('keywords', data.keywords);
      fd.set('action', data.action);
      if (data.autoReplyText) fd.set('autoReplyText', data.autoReplyText);
      if (data.isActive) fd.set('isActive', 'on');
      const res = await saveModerationRule({}, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Rule saved.');
      setDialogOpen(false);
      setForm({
        name: '',
        keywords: '',
        action: 'hide',
        autoReplyText: '',
        isActive: true,
      });
      refresh();
    });
  };

  const onToggle = (r: Rule, next: boolean) => {
    const id = getRuleId(r);
    if (!id) return;
    startMutating(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('ruleId', id);
      fd.set('keywords', r.keywords ?? r.pattern ?? '');
      fd.set('action', String(r.action ?? 'hide'));
      if (r.autoReplyText) fd.set('autoReplyText', r.autoReplyText);
      if (next) fd.set('isActive', 'on');
      const res = await saveModerationRule({}, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      refresh();
    });
  };

  const onDelete = (r: Rule) => {
    const id = getRuleId(r);
    if (!id) return;
    const label = r.name ?? r.keywords ?? 'this rule';
    if (!window.confirm(`Delete rule "${label}"? This cannot be undone.`)) return;
    startMutating(async () => {
      const res = await deleteModerationRule(id);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Rule deleted.');
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<ShieldCheck />}
          title="No project selected"
          description="Pick a Facebook project to manage moderation rules."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Moderation</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Moderation</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Auto-handle comments and visitor posts that match your patterns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load moderation rules</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && rules.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No moderation rules"
          description="Add a rule to automatically hide, delete, or flag matching comments."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rules.map((r) => {
            const id = getRuleId(r);
            return (
              <li key={id || (r.keywords ?? r.name)}>
                <Card className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 text-base text-zoru-ink">
                          {r.name ?? r.keywords ?? '(unnamed)'}
                        </p>
                        <Badge variant={actionVariant(r.action)}>
                          {r.action ?? 'hide'}
                        </Badge>
                      </div>
                      {r.keywords || r.pattern ? (
                        <p className="mt-1 line-clamp-1 font-mono text-xs text-zoru-ink-muted">
                          {r.keywords ?? r.pattern}
                        </p>
                      ) : null}
                      {r.autoReplyText ? (
                        <p className="mt-1 line-clamp-1 text-xs text-zoru-ink-muted">
                          Auto-reply: {r.autoReplyText}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!r.isActive}
                          onCheckedChange={(v) => onToggle(r, v)}
                          disabled={mutating}
                          aria-label="Toggle rule active"
                        />
                        <span className="text-xs text-zoru-ink-muted">
                          {r.isActive ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(r)}
                        disabled={mutating}
                        aria-label="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New moderation rule</ZoruDialogTitle>
            <ZoruDialogDescription>
              Match keywords or regex against incoming Page comments and apply an action.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-name">Name (optional)</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Spam filter"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-keywords">Pattern / keywords</Label>
              <Textarea
                id="rule-keywords"
                rows={3}
                value={form.keywords}
                onChange={(e) =>
                  setForm((p) => ({ ...p, keywords: e.target.value }))
                }
                placeholder="comma-separated keywords or a regex pattern"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Action</Label>
              <Select
                value={form.action}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, action: v as RuleAction }))
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rule-reply">Auto-reply (optional)</Label>
              <Input
                id="rule-reply"
                value={form.autoReplyText}
                onChange={(e) =>
                  setForm((p) => ({ ...p, autoReplyText: e.target.value }))
                }
                placeholder="Thanks — a moderator will review your comment."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-active">Enabled</Label>
              <Switch
                id="rule-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            </div>
          </div>

          <ZoruDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={mutating}
            >
              Cancel
            </Button>
            <Button onClick={() => submit()} disabled={mutating}>
              {mutating ? 'Saving…' : 'Save rule'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
