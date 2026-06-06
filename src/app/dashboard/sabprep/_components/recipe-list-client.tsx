'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Trash2, Sparkles } from 'lucide-react';

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
    Field,
    Input,
    Badge,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
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

    const onCreate = React.useCallback(async () => {
        setBusy(true);
        try {
            const res = await createRecipe({
                name: `Untitled recipe ${new Date().toLocaleTimeString()}`,
                steps: [],
            });
            router.push(`/dashboard/dataprep/recipes/${res.id}`);
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
        <div className="ui20 flex flex-col gap-6 p-6">
            <PageHeader className="flex-wrap items-end justify-between gap-4">
                <PageHeaderHeading>
                    <PageTitle>DataPrep</PageTitle>
                    <PageDescription>
                        Clean, transform, join, and profile tabular data before sending it to BI.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Field className="w-64">
                        <Input
                            placeholder="Search recipes"
                            aria-label="Search recipes"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </Field>
                    <Button
                        variant="primary"
                        iconLeft={Plus}
                        onClick={onCreate}
                        loading={busy}
                    >
                        New recipe
                    </Button>
                </PageActions>
            </PageHeader>

            {filtered.length === 0 ? (
                <EmptyState
                    icon={Sparkles}
                    title="No recipes yet"
                    description="Create a recipe to start cleaning and transforming a dataset."
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((r) => (
                        <Card key={r._id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-2">
                                    <span className="truncate">{r.name}</span>
                                    {r.scheduleCron ? (
                                        <Badge tone="info">scheduled</Badge>
                                    ) : null}
                                </CardTitle>
                                <CardDescription>
                                    {r.description ?? `${(r.steps ?? []).length} step(s)`}
                                </CardDescription>
                            </CardHeader>
                            <CardBody className="flex-1 text-xs text-[var(--st-text-secondary)]">
                                <p>Updated: {r.updatedAt ?? r.createdAt}</p>
                                {r.lastRunId ? <p>Last run: {r.lastRunId}</p> : null}
                            </CardBody>
                            <CardFooter className="flex items-center justify-between">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    iconLeft={Play}
                                    onClick={() =>
                                        router.push(`/dashboard/dataprep/recipes/${r._id}`)
                                    }
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
                    ))}
                </div>
            )}
        </div>
    );
}
