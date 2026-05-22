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
  Textarea,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { AlertCircle,
  Bot,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  createFacebookAgent,
  deleteFacebookAgent,
  getFacebookAgents,
  updateFacebookAgent,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/agents — Facebook chatbot agents.
 *
 * Lists chatbot agents for the active project and supports create / toggle
 * active / delete via the `wachat-facebook-agents` Rust crate.
 */

import * as React from 'react';

interface Agent {
  _id?: string;
  id?: string;
  name: string;
  personality?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
  model?: string;
  isActive?: boolean;
}

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (default)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
];

function getAgentId(a: Agent): string {
  return String(a._id ?? a.id ?? '');
}

export default function FacebookAgentsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [mutating, startMutating] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    personality: string;
    welcomeMessage: string;
    model: string;
  }>({ name: '', personality: '', welcomeMessage: '', model: 'gpt-4o-mini' });

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getFacebookAgents(projectId);
      if (res.error) {
        setError(res.error);
        setAgents([]);
        return;
      }
      setError(null);
      setAgents((res.agents as Agent[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = () => {
    if (!projectId) return;
    if (!form.name.trim()) {
      zoruSonnerToast.error('Agent name is required.');
      return;
    }
    startMutating(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('name', form.name);
      fd.set('personality', form.personality);
      fd.set('welcomeMessage', form.welcomeMessage);
      fd.set('isActive', 'on');
      const res = await createFacebookAgent({}, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Agent created.');
      setDialogOpen(false);
      setForm({
        name: '',
        personality: '',
        welcomeMessage: '',
        model: 'gpt-4o-mini',
      });
      refresh();
    });
  };

  const onToggleActive = (a: Agent) => {
    const id = getAgentId(a);
    if (!id) return;
    startMutating(async () => {
      const res = await updateFacebookAgent(id, { isActive: !a.isActive });
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(a.isActive ? 'Agent paused.' : 'Agent resumed.');
      refresh();
    });
  };

  const onDelete = (a: Agent) => {
    const id = getAgentId(a);
    if (!id) return;
    if (!window.confirm(`Delete agent "${a.name}"? This cannot be undone.`)) return;
    startMutating(async () => {
      const res = await deleteFacebookAgent(id);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Agent deleted.');
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Bot />}
          title="No project selected"
          description="Pick a Facebook project to manage its chatbot agents."
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
            <ZoruBreadcrumbPage>Agents</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Facebook Agents</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Chatbot agents that auto-reply to Messenger and Page comments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New agent
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load agents</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && agents.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Bot />}
          title="No agents yet"
          description="Create your first chatbot agent to handle Messenger replies."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => {
            const id = getAgentId(a);
            return (
              <li key={id || a.name}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-base text-zoru-ink">{a.name}</p>
                      <Badge
                        variant={a.isActive ? 'success' : 'ghost'}
                        className="mt-1"
                      >
                        {a.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onToggleActive(a)}
                        disabled={mutating}
                        aria-label={a.isActive ? 'Pause agent' : 'Resume agent'}
                      >
                        {a.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(a)}
                        disabled={mutating}
                        aria-label="Delete agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {a.personality ? (
                    <p className="line-clamp-3 text-xs text-zoru-ink-muted">
                      {a.personality}
                    </p>
                  ) : null}
                  {a.model ? (
                    <p className="text-[11px] text-zoru-ink-muted">
                      Model: <span className="text-zoru-ink">{a.model}</span>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New agent</ZoruDialogTitle>
            <ZoruDialogDescription>
              Create a chatbot agent for this project.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Support bot"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="agent-prompt">Persona / system prompt</Label>
              <Textarea
                id="agent-prompt"
                rows={4}
                value={form.personality}
                onChange={(e) =>
                  setForm((p) => ({ ...p, personality: e.target.value }))
                }
                placeholder="You are a friendly support agent for…"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="agent-welcome">Welcome message (optional)</Label>
              <Input
                id="agent-welcome"
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm((p) => ({ ...p, welcomeMessage: e.target.value }))
                }
                placeholder="Hi! How can I help you today?"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Model</Label>
              <Select
                value={form.model}
                onValueChange={(v) => setForm((p) => ({ ...p, model: v }))}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {MODEL_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-zoru-ink-muted">
              Note: the Rust backend currently uses a single project-wide model;
              this selection is stored client-side until per-agent model wiring lands.
            </p>
          </div>

          <ZoruDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={mutating}
            >
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={mutating}>
              {mutating ? 'Creating…' : 'Create agent'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
