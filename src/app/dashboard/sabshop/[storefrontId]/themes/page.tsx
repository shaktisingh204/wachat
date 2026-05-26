'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle,
    Input, Label, Textarea, Badge, useZoruToast,
} from '@/components/zoruui';

import {
    listThemes, createTheme, deleteTheme,
    getStorefront, updateStorefront,
} from '@/app/actions/sabshop.actions';

interface ThemeDoc {
    _id: string;
    name: string;
    description?: string;
    system?: boolean;
}

export default function ThemesPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useZoruToast();
    const id = params.storefrontId;
    const [themes, setThemes] = React.useState<ThemeDoc[]>([]);
    const [activeThemeId, setActiveThemeId] = React.useState<string>('');
    const [name, setName] = React.useState('');
    const [config, setConfig] = React.useState('{\n  "primary": "#5b21b6",\n  "font": "Inter"\n}');

    const load = React.useCallback(async () => {
        const [tRes, sfRes] = await Promise.all([listThemes(), getStorefront(id)]);
        if (tRes.ok) setThemes(tRes.items as ThemeDoc[]);
        if (sfRes.ok) {
            const sf = sfRes.item as { themeId?: string };
            setActiveThemeId(sf.themeId ?? '');
        }
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!name.trim()) return;
        let parsed: unknown = {};
        try { parsed = JSON.parse(config); } catch {
            toast({ title: 'Theme config must be valid JSON', variant: 'destructive' });
            return;
        }
        const r = await createTheme({ name, configJson: parsed });
        if (!r.ok) { toast({ title: r.error, variant: 'destructive' }); return; }
        setName('');
        load();
    }

    async function onApply(themeId: string) {
        const r = await updateStorefront(id, { themeId });
        if (r.ok) { setActiveThemeId(themeId); toast({ title: 'Theme applied' }); }
    }

    async function onDelete(themeId: string) {
        if (!confirm('Delete this theme?')) return;
        const r = await deleteTheme(themeId);
        if (r.ok) load();
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold text-zoru-ink">Themes</h1>

            <Card className="max-w-2xl">
                <ZoruCardHeader><ZoruCardTitle>New custom theme</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label>Config JSON</Label>
                        <Textarea rows={6} value={config} onChange={(e) => setConfig(e.target.value)} />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={onCreate}>Save theme</Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader><ZoruCardTitle>All themes</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent>
                    {themes.length === 0 ? (
                        <p className="text-sm text-zoru-ink-muted">No themes yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-border">
                            {themes.map((t) => (
                                <li key={t._id} className="flex items-center gap-3 py-2 text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium text-zoru-ink">{t.name}</div>
                                        {t.description && <div className="text-xs text-zoru-ink-muted">{t.description}</div>}
                                    </div>
                                    {t.system && <Badge variant="ghost">System</Badge>}
                                    {activeThemeId === t._id ? (
                                        <Badge variant="success">Active</Badge>
                                    ) : (
                                        <Button size="sm" variant="outline" onClick={() => onApply(t._id)}>Apply</Button>
                                    )}
                                    {!t.system && (
                                        <Button size="sm" variant="destructive" onClick={() => onDelete(t._id)}>Delete</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
