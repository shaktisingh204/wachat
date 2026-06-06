'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  Label,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Radio,
  RadioGroup,
  Switch,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import { Eye, Monitor, Moon, Save, Sun } from 'lucide-react';

import {
  getAppearancePrefs,
  setAppearancePrefs,
} from '@/app/actions/account.actions';
import { useT } from '@/lib/i18n/client';
import { applyTheme } from '@/components/sabcrm/20ui';

type Appearance = {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
};

const DEFAULTS: Appearance = {
  theme: 'system',
  density: 'comfortable',
  sidebarCollapsed: false,
  reducedMotion: false,
};

export default function AppearanceSettingsPage() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<Appearance>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    getAppearancePrefs()
      .then((server) => {
        if (cancelled) return;
        const merged = { ...DEFAULTS, ...server };
        setPrefs(merged);
        // Seed localStorage + apply the server-stored theme so the
        // no-FOUC bootstrap and the header toggle match it next load.
        applyTheme(merged.theme);
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
      // Apply + persist the theme immediately (also writes localStorage so
      // the no-FOUC bootstrap and header toggle stay in sync).
      applyTheme(prefs.theme);
      toast.success(t('settings.appearance.toast.saved'));
    } catch (e: any) {
      toast({
        title: t('settings.appearance.toast.saveFailed'),
        description: e?.message ?? t('common.tryAgain'),
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/settings">
              {t('settings.overview.title')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.appearance.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader bordered={false}>
          <PageHeading>
            <PageTitle>{t('settings.appearance.title')}</PageTitle>
            <PageDescription>{t('settings.appearance.subtitle')}</PageDescription>
          </PageHeading>
        </PageHeader>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          loading={saving}
          iconLeft={Save}
        >
          {saving ? t('common.saving') : t('action.save')}
        </Button>
      </div>

      {/* Theme */}
      <Card padding="lg">
        <CardHeader>
          <SectionTitle
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            title={t('settings.appearance.theme.title')}
            description={t('settings.appearance.theme.description')}
          />
        </CardHeader>
        <CardBody>
          <RadioGroup
            aria-label={t('settings.appearance.theme.title')}
            value={prefs.theme}
            onValueChange={(v) =>
              setPrefs({ ...prefs, theme: v as Appearance['theme'] })
            }
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <ThemeTile
              value="system"
              selected={prefs.theme === 'system'}
              icon={<Monitor className="h-5 w-5" aria-hidden="true" />}
              label={t('settings.appearance.theme.system')}
            />
            <ThemeTile
              value="light"
              selected={prefs.theme === 'light'}
              icon={<Sun className="h-5 w-5" aria-hidden="true" />}
              label={t('settings.appearance.theme.light')}
            />
            <ThemeTile
              value="dark"
              selected={prefs.theme === 'dark'}
              icon={<Moon className="h-5 w-5" aria-hidden="true" />}
              label={t('settings.appearance.theme.dark')}
            />
          </RadioGroup>
        </CardBody>
      </Card>

      {/* Density */}
      <Card padding="lg">
        <CardHeader>
          <SectionTitle
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            title={t('settings.appearance.density.title')}
            description={t('settings.appearance.density.description')}
          />
        </CardHeader>
        <CardBody>
          <RadioGroup
            aria-label={t('settings.appearance.density.title')}
            value={prefs.density}
            onValueChange={(v) =>
              setPrefs({ ...prefs, density: v as Appearance['density'] })
            }
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <DensityTile
              value="comfortable"
              selected={prefs.density === 'comfortable'}
              label={t('settings.appearance.density.comfortable.label')}
              description={t('settings.appearance.density.comfortable.description')}
            />
            <DensityTile
              value="compact"
              selected={prefs.density === 'compact'}
              label={t('settings.appearance.density.compact.label')}
              description={t('settings.appearance.density.compact.description')}
            />
          </RadioGroup>
        </CardBody>
      </Card>

      {/* Misc */}
      <Card padding="lg">
        <CardHeader>
          <SectionTitle
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            title={t('settings.appearance.motion.title')}
            description={t('settings.appearance.motion.description')}
          />
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-[var(--st-border)]">
            <Row
              id="collapsed"
              label={t('settings.appearance.motion.sidebar.label')}
              description={t('settings.appearance.motion.sidebar.description')}
              checked={prefs.sidebarCollapsed}
              onChange={(v) => setPrefs({ ...prefs, sidebarCollapsed: v })}
            />
            <Row
              id="reduced-motion"
              label={t('settings.appearance.motion.reducedMotion.label')}
              description={t('settings.appearance.motion.reducedMotion.description')}
              checked={prefs.reducedMotion}
              onChange={(v) => setPrefs({ ...prefs, reducedMotion: v })}
            />
          </ul>
        </CardBody>
      </Card>
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
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--st-text)]">{title}</p>
        <p className="text-xs text-[var(--st-text-secondary)]">{description}</p>
      </div>
    </div>
  );
}

function ThemeTile({
  value,
  selected,
  icon,
  label,
}: {
  value: string;
  selected: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Radio
      value={value}
      className={cn(
        'flex items-center gap-3 rounded-[var(--st-radius)] border p-4 text-left transition-colors',
        selected
          ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)] hover:border-[var(--st-border-strong)]',
      )}
      label={
        <span className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)]',
              selected
                ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
            )}
          >
            {icon}
          </span>
          <span className="text-[13px] text-[var(--st-text)]">{label}</span>
        </span>
      }
    />
  );
}

function DensityTile({
  value,
  selected,
  label,
  description,
}: {
  value: string;
  selected: boolean;
  label: string;
  description: string;
}) {
  return (
    <Radio
      value={value}
      className={cn(
        'items-start rounded-[var(--st-radius)] border p-4 text-left transition-colors',
        selected
          ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)] hover:border-[var(--st-border-strong)]',
      )}
      label={
        <span className="flex flex-col">
          <span className="text-[13px] text-[var(--st-text)]">{label}</span>
          <span className="mt-1 text-xs text-[var(--st-text-secondary)]">
            {description}
          </span>
        </span>
      }
    />
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
        <Label htmlFor={id} className="text-[13px]">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} />
    </li>
  );
}
