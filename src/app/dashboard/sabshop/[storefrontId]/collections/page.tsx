'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Input, Label,
    useZoruToast, Badge,
} from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

import {
    listCollections, createCollection, updateCollection, deleteCollection,
} from '@/app/actions/sabshop.actions';

interface CollectionRow {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    published?: boolean;
}

export default function CollectionsPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useZoruToast();
    const id = params.storefrontId;
    const [items, setItems] = React.useState<CollectionRow[]>([]);
    const [name, setName] = React.useState('');
    const [slug, setSlug] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        const r = await listCollections(id);
        if (r.ok) setItems(r.items as CollectionRow[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!name.trim() || !slug.trim()) return;
        setBusy(true);
        const r = await createCollection({ storefrontId: id, name, slug });
        setBusy(false);
        if (!r.ok) { toast({ title: r.error, variant: 'destructive' }); return; }
        setName(''); setSlug('');
        load();
    }

    async function onTogglePublish(c: CollectionRow) {
        const r = await updateCollection(c._id, { published: !c.published });
        if (r.ok) load();
    }

    async function onDelete(cid: string) {
        if (!confirm('Delete this collection?')) return;
        const r = await deleteCollection(cid);
        if (r.ok) load();
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold text-zoru-ink">Collections</h1>

            <Card className="max-w-2xl">
                <ZoruCardHeader><ZoruCardTitle>New collection</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1 space-y-1">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="sm:col-span-1 space-y-1">
                        <Label>Slug</Label>
                        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                        <Button onClick={onCreate} disabled={busy} className="w-full">
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader><ZoruCardTitle>All collections</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent>
                    {items.length === 0 ? (
                        <p className="text-sm text-zoru-ink-muted">No collections yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-border">
                            {items.map((c) => (
                                <li key={c._id} className="flex items-center gap-3 py-2">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zoru-ink">{c.name}</div>
                                        <div className="text-xs text-zoru-ink-muted">/{c.slug}</div>
                                    </div>
                                    <Badge variant={c.published ? 'success' : 'ghost'}>
                                        {c.published ? 'Published' : 'Draft'}
                                    </Badge>
                                    <Button size="sm" variant="outline" onClick={() => onTogglePublish(c)}>
                                        {c.published ? 'Unpublish' : 'Publish'}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDelete(c._id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
