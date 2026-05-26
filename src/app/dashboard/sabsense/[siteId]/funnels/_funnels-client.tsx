'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Play } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    Dialog,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter,
    Input,
    Label,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    ZoruPageActions,
    Progress,
    Badge,
    EmptyState,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    useZoruToast,
} from '@/components/zoruui';

import {
    createFunnel,
    deleteFunnel,
    runFunnel,
} from '@/app/actions/sabsense.actions';
import type { Funnel, FunnelStep, StepMatchType } from '@/lib/rust-client/pagesense-funnels';
import type { FunnelRun } from '@/lib/rust-client/pagesense-funnel-runs';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';

import { PagesenseSiteNav } from '../_site-nav';

interface Props {
    site: PagesenseSite | null;
    funnels: Funnel[];
    runsByFunnel: Record<string, FunnelRun[]>;
}

export function FunnelsClient({ site, funnels, runsByFunnel }: Props) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [steps, setSteps] = useState<FunnelStep[]>([
        { name: 'Landing', matchType: 'url', pattern: '/' },
        { name: 'Signup', matchType: 'url', pattern: '/signup' },
    ]);
    const [pending, startTransition] = useTransition();

    if (!site) {
        return (
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                Site not found.
            </div>
        );
    }

    const addStep = () =>
        setSteps((prev) => [...prev, { name: '', matchType: 'url', pattern: '' }]);
    const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));
    const updateStep = (idx: number, patch: Partial<FunnelStep>) =>
        setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

    const handleCreate = () => {
        if (!name.trim() || steps.length === 0) {
            toast({ title: 'Missing name or steps', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const res = await createFunnel({ siteId: site._id, name, steps });
            if (res.success) {
                toast({ title: 'Funnel created' });
                setIsOpen(false);
                setName('');
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const handleDelete = (funnelId: string) => {
        startTransition(async () => {
            const res = await deleteFunnel(site._id, funnelId);
            if (res.success) {
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const handleRun = (funnelId: string) => {
        const periodToMs = Date.now();
        const periodFromMs = periodToMs - 7 * 24 * 60 * 60 * 1000;
        startTransition(async () => {
            const res = await runFunnel(site._id, { funnelId, periodFromMs, periodToMs });
            if (res.success) {
                toast({ title: 'Funnel run queued' });
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <ZoruPageTitle>{site.name} — Funnels</ZoruPageTitle>
                <ZoruPageDescription>
                    Define ordered steps and inspect dropoff across each transition.
                </ZoruPageDescription>
                <ZoruPageActions>
                    <Button onClick={() => setIsOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New funnel
                    </Button>
                </ZoruPageActions>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            {funnels.length === 0 ? (
                <EmptyState
                    title="No funnels yet"
                    description="Create a funnel to track multi-step conversion paths."
                    action={
                        <Button onClick={() => setIsOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New funnel
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {funnels.map((f) => {
                        const runs = runsByFunnel[f._id] || [];
                        const latest = runs[0];
                        return (
                            <Card key={f._id}>
                                <ZoruCardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <ZoruCardTitle>{f.name}</ZoruCardTitle>
                                            <ZoruCardDescription>
                                                {f.steps.length} step(s) · {runs.length} run(s)
                                            </ZoruCardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleRun(f._id)}
                                                disabled={pending}
                                            >
                                                <Play className="mr-2 h-4 w-4" /> Run
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(f._id)}
                                                disabled={pending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="space-y-3">
                                        {latest
                                            ? latest.steps.map((step, i) => {
                                                  const pct =
                                                      latest.totalSessions > 0
                                                          ? Math.round(
                                                                (step.count /
                                                                    latest.totalSessions) *
                                                                    100,
                                                            )
                                                          : 0;
                                                  return (
                                                      <div key={i} className="space-y-1">
                                                          <div className="flex justify-between text-sm">
                                                              <span>
                                                                  {i + 1}. {step.name}
                                                              </span>
                                                              <span className="text-[color:var(--zoru-fg-muted)]">
                                                                  {step.count} ·{' '}
                                                                  {Math.round(step.dropoffRate * 100)}% drop
                                                              </span>
                                                          </div>
                                                          <Progress value={pct} />
                                                      </div>
                                                  );
                                              })
                                            : f.steps.map((step, i) => (
                                                  <div
                                                      key={i}
                                                      className="flex items-center justify-between text-sm"
                                                  >
                                                      <span>
                                                          {i + 1}. {step.name}
                                                      </span>
                                                      <Badge variant="secondary">
                                                          {step.matchType}: {step.pattern}
                                                      </Badge>
                                                  </div>
                                              ))}
                                        {!latest && (
                                            <p className="pt-2 text-xs text-[color:var(--zoru-fg-muted)]">
                                                No runs yet. Click Run to compute step counts.
                                            </p>
                                        )}
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New funnel</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="f-name">Name</Label>
                            <Input
                                id="f-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Signup funnel"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Steps</Label>
                            {steps.map((s, i) => (
                                <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2">
                                    <Input
                                        placeholder="Step name"
                                        value={s.name}
                                        onChange={(e) => updateStep(i, { name: e.target.value })}
                                    />
                                    <Select
                                        value={s.matchType}
                                        onValueChange={(v) =>
                                            updateStep(i, { matchType: v as StepMatchType })
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="url">URL</ZoruSelectItem>
                                            <ZoruSelectItem value="event">Event</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </Select>
                                    <Input
                                        placeholder="Pattern"
                                        value={s.pattern}
                                        onChange={(e) =>
                                            updateStep(i, { pattern: e.target.value })
                                        }
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStep(i)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={addStep}>
                                <Plus className="mr-2 h-4 w-4" /> Add step
                            </Button>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={pending}>
                            Create
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
