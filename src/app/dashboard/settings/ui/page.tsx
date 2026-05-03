'use client';

import { useEffect, useState } from 'react';
import { LuSun, LuMoon, LuMonitor, LuEye, LuSave, LuLoaderCircle } from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Appearance = {
    theme: 'system' | 'light' | 'dark';
    density: 'comfortable' | 'compact';
    sidebarCollapsed: boolean;
    reducedMotion: boolean;
};

const STORAGE_KEY = 'settings_appearance_v1';

const DEFAULTS: Appearance = {
    theme: 'system',
    density: 'comfortable',
    sidebarCollapsed: false,
    reducedMotion: false,
};

export default function AppearanceSettingsPage() {
    const [prefs, setPrefs] = useState<Appearance>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
        } catch { /* ignore */ }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
            toast({ title: 'Appearance saved' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Appearance' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Appearance"
                subtitle="Theme, density, and motion preferences for your SabNode workspace."
                actions={
                    <ClayButton
                        variant="obsidian"
                        size="sm"
                        leading={saving ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuSave className="h-4 w-4" />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </ClayButton>
                }
            />

            {/* Theme */}
            <ClayCard padded>
                <SectionTitle
                    icon={<LuEye className="h-4 w-4" />}
                    title="Theme"
                    description="Pick a color mode. System follows your OS setting."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <ThemeTile
                        selected={prefs.theme === 'system'}
                        icon={<LuMonitor className="h-5 w-5" />}
                        label="System"
                        onClick={() => setPrefs({ ...prefs, theme: 'system' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'light'}
                        icon={<LuSun className="h-5 w-5" />}
                        label="Light"
                        onClick={() => setPrefs({ ...prefs, theme: 'light' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'dark'}
                        icon={<LuMoon className="h-5 w-5" />}
                        label="Dark"
                        onClick={() => setPrefs({ ...prefs, theme: 'dark' })}
                    />
                </div>
            </ClayCard>

            {/* Density */}
            <ClayCard padded>
                <SectionTitle
                    icon={<LuEye className="h-4 w-4" />}
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
            </ClayCard>

            {/* Misc */}
            <ClayCard padded>
                <SectionTitle
                    icon={<LuEye className="h-4 w-4" />}
                    title="Motion & navigation"
                    description="Fine-tune how the UI behaves around you."
                />
                <ul className="divide-y divide-border">
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
            </ClayCard>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                {icon}
            </div>
            <div>
                <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
                <p className="text-[12.5px] text-muted-foreground">{description}</p>
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
                    ? 'border-foreground bg-muted/50'
                    : 'border-border bg-card hover:border-border',
            )}
        >
            <div
                className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    selected ? 'bg-foreground text-white' : 'bg-muted/50 text-foreground',
                )}
            >
                {icon}
            </div>
            <span className="text-[13px] font-semibold text-foreground">{label}</span>
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
                    ? 'border-foreground bg-muted/50'
                    : 'border-border bg-card hover:border-border',
            )}
        >
            <p className="text-[13px] font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
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
                <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
                    {label}
                </Label>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
            </div>
            <Switch id={id} checked={checked} onCheckedChange={onChange} />
        </li>
    );
}
