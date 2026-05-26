'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Play, Trash2, Sparkles } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    ZoruCardContent,
    ZoruCardFooter,
    EmptyState,
    Input,
    Badge,
} from '@/components/zoruui';
import {
    createRecipe,
    deleteRecipe,
} from '@/app/actions/sabprep.actions';
import type {
    DataprepRecipeDoc,
    DataprepRecipeListResult,
} from '@/lib/rust-client/dataprep-recipes';

interface Props {
    initial: DataprepRecipeListResult;
}

export function RecipeListClient({ initial }: Props) {
    const router = useRouter();
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
        } finally {
            setBusy(false);
        }
    }, [router]);

    const onDelete = React.useCallback(async (id: string) => {
        if (!confirm('Archive this recipe?')) return;
        await deleteRecipe(id);
        setItems((prev) => prev.filter((r) => r._id !== id));
    }, []);

    return (
        <div className="zoruui flex flex-col gap-6 p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">DataPrep</h1>
                    <p className="text-sm opacity-70">
                        Clean, transform, join, and profile tabular data before sending it to BI.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search recipes"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-64"
                    />
                    <Button onClick={onCreate} disabled={busy}>
                        <Plus className="h-4 w-4" /> New recipe
                    </Button>
                </div>
            </header>

            {filtered.length === 0 ? (
                <EmptyState
                    icon={<Sparkles className="h-6 w-6" />}
                    title="No recipes yet"
                    description="Create a recipe to start cleaning and transforming a dataset."
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((r) => (
                        <Card key={r._id} className="flex flex-col">
                            <ZoruCardHeader>
                                <ZoruCardTitle className="flex items-center justify-between gap-2">
                                    <span className="truncate">{r.name}</span>
                                    {r.scheduleCron ? (
                                        <Badge variant="secondary">scheduled</Badge>
                                    ) : null}
                                </ZoruCardTitle>
                                <ZoruCardDescription>
                                    {r.description ?? `${(r.steps ?? []).length} step(s)`}
                                </ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent className="flex-1 text-xs opacity-70">
                                <p>Updated: {r.updatedAt ?? r.createdAt}</p>
                                {r.lastRunId ? <p>Last run: {r.lastRunId}</p> : null}
                            </ZoruCardContent>
                            <ZoruCardFooter className="flex items-center justify-between">
                                <Button asChild size="sm" variant="outline">
                                    <Link href={`/dashboard/dataprep/recipes/${r._id}`}>
                                        <Play className="h-3.5 w-3.5" /> Open
                                    </Link>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onDelete(String(r._id))}
                                    aria-label="Archive recipe"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </ZoruCardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
