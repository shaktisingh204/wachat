'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Trash2, Layers, Clock, CalendarClock, FileSpreadsheet } from 'lucide-react';

import {
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    CardFooter,
    EmptyState,
    Badge,
    StatCard,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    SearchInput,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    createRecipe,
    deleteRecipe,
} from '@/app/actions/sabprep.actions';
import type {
    DataprepRecipeDoc,
    DataprepRecipeListResult,
} from '@/lib/rust-client/sabprep-recipes';

interface Props {
    initial: DataprepRecipeListResult;
}

const RECIPE_BASE = '/dashboard/sabprep/recipes';

function formatDate(value?: string): string {
    if (!value) return 'Not recorded';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecipeListClient({ initial }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [items, setItems] = React.useState<DataprepRecipeDoc[]>(initial.items ?? []);
    const [query, setQuery] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                (r.description ?? '').toLowerCase().includes(q),
        );
    }, [items, query]);

    const stats = React.useMemo(() => {
        const scheduled = items.filter((r) => r.scheduleCron).length;
        const steps = items.reduce((sum, r) => sum + (r.steps ?? []).length, 0);
        return { total: items.length, scheduled, steps };
    }, [items]);

    const onCreate = React.useCallback(async () => {
        setBusy(true);
        try {
            const res = await createRecipe({
                name: `Untitled recipe ${new Date().toLocaleTimeString()}`,
                steps: [],
            });
            router.push(`${RECIPE_BASE}/${res.id}`);
        } catch (e) {
            console.error('createRecipe failed', e);
            toast.error('Could not create recipe. Please try again.');
        } finally {
            setBusy(false);
        }
    }, [router, toast]);

    const onDelete = React.useCallback(
        async (id: string) => {
            if (!confirm('Archive this recipe?')) return;
            try {
                await deleteRecipe(id);
                setItems((prev) => prev.filter((r) => r._id !== id));
                toast.success('Recipe archived.');
            } catch (e) {
                console.error('deleteRecipe failed', e);
                toast.error('Could not archive recipe.');
            }
        },
        [toast],
    );

    return (
        <div className="20ui flex flex-col gap-6 p-4 md:p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Data tools</PageEyebrow>
                    <PageTitle>DataPrep</PageTitle>
                    <PageDescription>
                        Clean, transform, join, and profile tabular data before it reaches BI.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <div className="w-64">
                        <SearchInput
                            placeholder="Search recipes"
                            aria-label="Search recipes"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                    <Button variant="primary" iconLeft={Plus} onClick={onCreate} loading={busy}>
                        New recipe
                    </Button>
                </PageActions>
            </PageHeader>

            <section aria-label="Recipe metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Recipes" value={stats.total.toLocaleString()} icon={<Layers />} accent="#2b6ef2" />
                <StatCard label="Scheduled" value={stats.scheduled.toLocaleString()} icon={<CalendarClock />} accent="#7c3aed" />
                <StatCard label="Total steps" value={stats.steps.toLocaleString()} icon={<FileSpreadsheet />} accent="#16a34a" />
            </section>

            {filtered.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Layers}
                            title={query ? 'No matching recipes' : 'No recipes yet'}
                            description={
                                query
                                    ? 'Try a different search term, or create a new recipe.'
                                    : 'Create a recipe to start cleaning and transforming a dataset.'
                            }
                            action={
                                <Button variant="primary" iconLeft={Plus} onClick={onCreate} loading={busy}>
                                    New recipe
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((r) => {
                        const stepCount = (r.steps ?? []).length;
                        return (
                            <Card key={r._id} variant="interactive" className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="truncate">{r.name}</CardTitle>
                                        {r.scheduleCron ? (
                                            <Badge tone="info" dot>
                                                Scheduled
                                            </Badge>
                                        ) : (
                                            <Badge tone="neutral">{stepCount} steps</Badge>
                                        )}
                                    </div>
                                    <CardDescription className="line-clamp-2">
                                        {r.description ?? `${stepCount} transformation step(s).`}
                                    </CardDescription>
                                </CardHeader>
                                <CardBody className="flex-1">
                                    <dl className="flex flex-col gap-1.5 text-xs text-[var(--st-text-secondary)]">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={13} aria-hidden="true" />
                                            <dt className="sr-only">Updated</dt>
                                            <dd>Updated {formatDate(r.updatedAt ?? r.createdAt)}</dd>
                                        </div>
                                        {r.lastRunId ? (
                                            <div className="flex items-center gap-1.5">
                                                <Play size={13} aria-hidden="true" />
                                                <dt className="sr-only">Last run</dt>
                                                <dd className="truncate font-mono">Run {r.lastRunId}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                </CardBody>
                                <CardFooter className="flex items-center justify-between">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        iconLeft={Play}
                                        onClick={() => router.push(`${RECIPE_BASE}/${r._id}`)}
                                    >
                                        Open
                                    </Button>
                                    <IconButton
                                        label="Archive recipe"
                                        icon={Trash2}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onDelete(String(r._id))}
                                    />
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
