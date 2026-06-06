'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Play, Filter } from 'lucide-react';

import {
    Button,
    IconButton,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Progress,
    Badge,
    EmptyState,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    useToast,
} from '@/components/sabcrm/20ui';

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
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [steps, setSteps] = useState<FunnelStep[]>([
        { name: 'Landing', matchType: 'url', pattern: '/' },
        { name: 'Signup', matchType: 'url', pattern: '/signup' },
    ]);
    const [pending, startTransition] = useTransition();

    if (!site) {
        return (
            <div className="p-8 text-sm text-[color:var(--st-text-secondary)]">
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
            toast.error('Missing name or steps');
            return;
        }
        startTransition(async () => {
            const res = await createFunnel({ siteId: site._id, name, steps });
            if (res.success) {
                toast.success('Funnel created');
                setIsOpen(false);
                setName('');
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, tone: 'danger' });
            }
        });
    };

    const handleDelete = (funnelId: string) => {
        startTransition(async () => {
            const res = await deleteFunnel(site._id, funnelId);
            if (res.success) {
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, tone: 'danger' });
            }
        });
    };

    const handleRun = (funnelId: string) => {
        const periodToMs = Date.now();
        const periodFromMs = periodToMs - 7 * 24 * 60 * 60 * 1000;
        startTransition(async () => {
            const res = await runFunnel(site._id, { funnelId, periodFromMs, periodToMs });
            if (res.success) {
                toast.success('Funnel run queued');
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, tone: 'danger' });
            }
        });
    };

    return (
        <div className="p-8 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{site.name} funnels</PageTitle>
                    <PageDescription>
                        Define ordered steps and inspect dropoff across each transition.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus} onClick={() => setIsOpen(true)}>
                        New funnel
                    </Button>
                </PageActions>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            {funnels.length === 0 ? (
                <EmptyState
                    icon={Filter}
                    title="No funnels yet"
                    description="Create a funnel to track multi-step conversion paths."
                    action={
                        <Button variant="primary" iconLeft={Plus} onClick={() => setIsOpen(true)}>
                            New funnel
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
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <CardTitle>{f.name}</CardTitle>
                                            <CardDescription>
                                                {f.steps.length} step(s), {runs.length} run(s)
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                iconLeft={Play}
                                                onClick={() => handleRun(f._id)}
                                                disabled={pending}
                                            >
                                                Run
                                            </Button>
                                            <IconButton
                                                size="sm"
                                                variant="ghost"
                                                icon={Trash2}
                                                label={`Delete funnel ${f.name}`}
                                                onClick={() => handleDelete(f._id)}
                                                disabled={pending}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardBody>
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
                                                              <span className="text-[color:var(--st-text-secondary)]">
                                                                  {step.count},{' '}
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
                                                      <Badge tone="neutral">
                                                          {step.matchType}: {step.pattern}
                                                      </Badge>
                                                  </div>
                                              ))}
                                        {!latest && (
                                            <p className="pt-2 text-xs text-[color:var(--st-text-secondary)]">
                                                No runs yet. Click Run to compute step counts.
                                            </p>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New funnel</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Field label="Name">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Signup funnel"
                            />
                        </Field>
                        <Field label="Steps">
                            <div className="space-y-2">
                                {steps.map((s, i) => (
                                    <div
                                        key={i}
                                        className="grid grid-cols-[1fr_120px_1fr_auto] gap-2"
                                    >
                                        <Input
                                            placeholder="Step name"
                                            aria-label={`Step ${i + 1} name`}
                                            value={s.name}
                                            onChange={(e) =>
                                                updateStep(i, { name: e.target.value })
                                            }
                                        />
                                        <Select
                                            value={s.matchType}
                                            onValueChange={(v) =>
                                                updateStep(i, { matchType: v as StepMatchType })
                                            }
                                        >
                                            <SelectTrigger aria-label={`Step ${i + 1} match type`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="url">URL</SelectItem>
                                                <SelectItem value="event">Event</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            placeholder="Pattern"
                                            aria-label={`Step ${i + 1} pattern`}
                                            value={s.pattern}
                                            onChange={(e) =>
                                                updateStep(i, { pattern: e.target.value })
                                            }
                                        />
                                        <IconButton
                                            variant="ghost"
                                            size="sm"
                                            icon={Trash2}
                                            label={`Remove step ${i + 1}`}
                                            onClick={() => removeStep(i)}
                                        />
                                    </div>
                                ))}
                                <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addStep}>
                                    Add step
                                </Button>
                            </div>
                        </Field>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button variant="primary" onClick={handleCreate} loading={pending}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
