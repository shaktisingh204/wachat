'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Palette } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    Input,
    Textarea,
    Badge,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    useToast,
} from '@/components/sabcrm/20ui';

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
    const { toast } = useToast();
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
            toast.error('Theme config must be valid JSON');
            return;
        }
        const r = await createTheme({ name, configJson: parsed });
        if (!r.ok) { toast.error(r.error); return; }
        setName('');
        load();
    }

    async function onApply(themeId: string) {
        const r = await updateStorefront(id, { themeId });
        if (r.ok) { setActiveThemeId(themeId); toast.success('Theme applied'); }
    }

    async function onDelete(themeId: string) {
        if (!confirm('Delete this theme?')) return;
        const r = await deleteTheme(themeId);
        if (r.ok) load();
    }

    return (
        <div className="flex flex-col gap-4 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Themes</PageTitle>
                </PageHeaderHeading>
                <PageActions />
            </PageHeader>

            <Card className="max-w-2xl">
                <CardHeader><CardTitle>New custom theme</CardTitle></CardHeader>
                <CardBody className="flex flex-col gap-3">
                    <Field label="Name">
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="Config JSON">
                        <Textarea rows={6} value={config} onChange={(e) => setConfig(e.target.value)} />
                    </Field>
                    <div className="flex justify-end">
                        <Button variant="primary" onClick={onCreate}>Save theme</Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>All themes</CardTitle></CardHeader>
                <CardBody>
                    {themes.length === 0 ? (
                        <EmptyState
                            icon={Palette}
                            title="No themes yet"
                            description="Create a custom theme above to get started."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {themes.map((t) => (
                                <li key={t._id} className="flex items-center gap-3 py-2 text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium text-[var(--st-text)]">{t.name}</div>
                                        {t.description && <div className="text-xs text-[var(--st-text-secondary)]">{t.description}</div>}
                                    </div>
                                    {t.system && <Badge tone="neutral">System</Badge>}
                                    {activeThemeId === t._id ? (
                                        <Badge tone="success">Active</Badge>
                                    ) : (
                                        <Button size="sm" variant="outline" onClick={() => onApply(t._id)}>Apply</Button>
                                    )}
                                    {!t.system && (
                                        <Button size="sm" variant="danger" onClick={() => onDelete(t._id)}>Delete</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
