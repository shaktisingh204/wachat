'use client';

import { useEffect, useState } from 'react';
import { Eye, LoaderCircle, Monitor, Moon, Save, Sun } from 'lucide-react';

import {
    ZoruBreadcrumb,
    ZoruBreadcrumbItem,
    ZoruBreadcrumbLink,
    ZoruBreadcrumbList,
    ZoruBreadcrumbPage,
    ZoruBreadcrumbSeparator,
    ZoruButton,
    ZoruCard,
    ZoruLabel,
    ZoruPageDescription,
    ZoruPageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruSwitch,
    cn,
    useZoruToast,
} from '@/components/zoruui';
import {
    getAppearancePrefs,
    setAppearancePrefs,
    type AppearancePrefs,
} from '@/app/actions/account.actions';

type Appearance = AppearancePrefs;

const DEFAULTS: Appearance = {
    theme: 'system',
    density: 'comfortable',
    sidebarCollapsed: false,
    reducedMotion: false,
};

export default function AppearanceSettingsPage() {
    const [prefs, setPrefs] = useState<Appearance>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useZoruToast();

    useEffect(() => {
        let cancelled = false;
        getAppearancePrefs()
            .then((server) => {
                if (cancelled) return;
                setPrefs({ ...DEFAULTS, ...server });
            })
            .catch(() => {
                /* fall through to defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setAppearancePrefs(prefs);
            // Apply theme immediately so the user sees the effect.
            if (typeof document !== 'undefined') {
                const root = document.documentElement;
                root.classList.remove('light', 'dark');
                if (prefs.theme === 'dark') root.classList.add('dark');
                else if (prefs.theme === 'light') root.classList.add('light');
            }
            toast({ title: 'Appearance saved' });
        } catch (e: any) {
            toast({
                title: 'Could not save',
                description: e?.message ?? 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Appearance</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>Appearance</ZoruPageTitle>
                        <ZoruPageDescription>
                            Theme, density, and motion preferences for your SabNode workspace.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <ZoruButton size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save'}
                </ZoruButton>
            </div>

            {/* Theme */}
            <ZoruCard className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title="Theme"
                    description="Pick a color mode. System follows your OS setting."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <ThemeTile
                        selected={prefs.theme === 'system'}
                        icon={<Monitor className="h-5 w-5" />}
                        label="System"
                        onClick={() => setPrefs({ ...prefs, theme: 'system' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'light'}
                        icon={<Sun className="h-5 w-5" />}
                        label="Light"
                        onClick={() => setPrefs({ ...prefs, theme: 'light' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'dark'}
                        icon={<Moon className="h-5 w-5" />}
                        label="Dark"
                        onClick={() => setPrefs({ ...prefs, theme: 'dark' })}
                    />
                </div>
            </ZoruCard>

            {/* Density */}
            <ZoruCard className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title="Density"
                    description="Adjust list row spacing to fit more content on screen."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DensityTile
                        selected={prefs.density === 'comfortable'}
                        label="Comfortable"
                        description="Roomy spacing with generous padding."
                        onClick={() => setPrefs({ ...prefs, density: 'comfortable' })}
                    />
                    <DensityTile
                        selected={prefs.density === 'compact'}
                        label="Compact"
                        description="Tighter rows, more data per screen."
                        onClick={() => setPrefs({ ...prefs, density: 'compact' })}
                    />
                </div>
            </ZoruCard>

            {/* Misc */}
            <ZoruCard className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title="Motion & navigation"
                    description="Fine-tune how the UI behaves around you."
                />
                <ul className="divide-y divide-zoru-line">
                    <Row
                        id="collapsed"
                        label="Collapse sidebar by default"
                        description="Start each session with the sidebar minimized."
                        checked={prefs.sidebarCollapsed}
                        onChange={(v) => setPrefs({ ...prefs, sidebarCollapsed: v })}
                    />
                    <Row
                        id="reduced-motion"
                        label="Reduce motion"
                        description="Minimize animations and transitions."
                        checked={prefs.reducedMotion}
                        onChange={(v) => setPrefs({ ...prefs, reducedMotion: v })}
                    />
                </ul>
            </ZoruCard>
        </div>
    );
}

function SectionTitle({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                {icon}
            </div>
            <div>
                <p className="text-sm text-zoru-ink">{title}</p>
                <p className="text-xs text-zoru-ink-muted">{description}</p>
            </div>
        </div>
    );
}

function ThemeTile({
    selected,
    icon,
    label,
    onClick,
}: {
    selected: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                selected
                    ? 'border-zoru-ink bg-zoru-surface-2'
                    : 'border-zoru-line bg-zoru-bg hover:border-zoru-line',
            )}
        >
            <div
                className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    selected ? 'bg-zoru-ink text-zoru-bg' : 'bg-zoru-surface-2 text-zoru-ink',
                )}
            >
                {icon}
            </div>
            <span className="text-[13px] text-zoru-ink">{label}</span>
        </button>
    );
}

function DensityTile({
    selected,
    label,
    description,
    onClick,
}: {
    selected: boolean;
    label: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                selected
                    ? 'border-zoru-ink bg-zoru-surface-2'
                    : 'border-zoru-line bg-zoru-bg hover:border-zoru-line',
            )}
        >
            <p className="text-[13px] text-zoru-ink">{label}</p>
            <p className="mt-1 text-xs text-zoru-ink-muted">{description}</p>
        </button>
    );
}

function Row({
    id,
    label,
    description,
    checked,
    onChange,
}: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <li className="flex items-start justify-between gap-4 py-3">
            <div>
                <ZoruLabel htmlFor={id} className="text-[13px]">
                    {label}
                </ZoruLabel>
                <p className="mt-0.5 text-xs text-zoru-ink-muted">{description}</p>
            </div>
            <ZoruSwitch id={id} checked={checked} onCheckedChange={onChange} />
        </li>
    );
}
