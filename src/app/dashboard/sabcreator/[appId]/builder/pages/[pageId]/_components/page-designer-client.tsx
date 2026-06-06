'use client';

/**
 * SabCreator page designer.
 *
 * Left: widget palette (KPI, List view, Chart, Form embed, Button, Text).
 * Center: drop zones, a vertical stack of widgets, reorderable.
 * Right: widget properties + page-level role visibility.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  LayoutGrid,
  List as ListIcon,
  MousePointerClick,
  PieChart,
  Save,
  SquareDashed,
  Trash2,
  Type as TypeIcon,
  type LucideIcon,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  PageActions,
  PageDescription,
  PageHeader,
  PageTitle,
  useToast,
} from '@/components/sabcrm/20ui';
import { updateSabcreatorPage } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type {
  SabcreatorPageDoc,
  SabcreatorPageRoleVisibility,
  SabcreatorPageWidget,
} from '@/lib/rust-client/sabcreator-pages';

type WidgetKind = 'kpi' | 'listView' | 'chart' | 'formEmbed' | 'button' | 'text';

const PALETTE: Array<{ kind: WidgetKind; label: string; icon: LucideIcon }> = [
  { kind: 'kpi', label: 'KPI card', icon: PieChart },
  { kind: 'listView', label: 'List view', icon: ListIcon },
  { kind: 'chart', label: 'Chart', icon: BarChart3 },
  { kind: 'formEmbed', label: 'Form embed', icon: SquareDashed },
  { kind: 'button', label: 'Button', icon: MousePointerClick },
  { kind: 'text', label: 'Text', icon: TypeIcon },
];

interface InternalWidget extends SabcreatorPageWidget {
  kind: WidgetKind | string;
}

function toInternal(config: unknown): InternalWidget[] {
  const c = (config ?? {}) as { widgets?: unknown };
  if (!Array.isArray(c.widgets)) return [];
  return c.widgets.map((w, i) => {
    const o = (w ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? `w-${i}`),
      kind: (o.kind as WidgetKind) ?? 'text',
      config: (o.config as Record<string, unknown>) ?? {},
    };
  });
}

interface Props {
  app: SabcreatorAppDoc;
  page: SabcreatorPageDoc;
}

export function PageDesignerClient({ app, page }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<InternalWidget[]>(() =>
    toInternal(page.configJson),
  );
  const [selectedId, setSelectedId] = useState<string | null>(widgets[0]?.id ?? null);
  const [roleVisibility, setRoleVisibility] =
    useState<SabcreatorPageRoleVisibility>(page.roleVisibility);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => widgets.find((w) => w.id === selectedId) ?? null,
    [widgets, selectedId],
  );

  const addWidget = (kind: WidgetKind) => {
    const id = `w-${Date.now().toString(36)}`;
    setWidgets((p) => [
      ...p,
      {
        id,
        kind,
        config: kind === 'text' ? { content: 'New text widget' } : {},
      },
    ]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<InternalWidget>) => {
    if (!selected) return;
    setWidgets((p) =>
      p.map((w) => (w.id === selected.id ? { ...w, ...patch } : w)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    setWidgets((p) => p.filter((w) => w.id !== selected.id));
    setSelectedId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    setWidgets((p) => {
      const idx = p.findIndex((w) => w.id === id);
      if (idx < 0) return p;
      const target = idx + dir;
      if (target < 0 || target >= p.length) return p;
      const next = p.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateSabcreatorPage(page._id, app._id, {
          configJson: { widgets },
          roleVisibility,
        });
        toast.success('Page saved');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] savePage failed', err);
        toast.error('Could not save the page');
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <div>
          <PageTitle>{page.name}</PageTitle>
          <PageDescription>
            Page designer, {page.kind},{' '}
            <Link
              href={`/dashboard/sabcreator/${app._id}/builder`}
              className="underline"
            >
              back to builder
            </Link>
          </PageDescription>
        </div>
        <PageActions>
          <Badge variant="outline">{page.status}</Badge>
          <Button variant="primary" iconLeft={Save} onClick={save} loading={pending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[200px_1fr_320px] gap-4 px-6 pb-10">
        <aside>
          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Widgets
              </CardTitle>
            </CardHeader>
            <div className="space-y-1">
              {PALETTE.map((p) => (
                <Button
                  key={p.kind}
                  variant="ghost"
                  size="sm"
                  block
                  iconLeft={p.icon}
                  onClick={() => addWidget(p.kind)}
                  className="justify-start"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </Card>
        </aside>

        <main>
          <Card padding="md">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Canvas, {page.kind}
              </CardTitle>
            </CardHeader>
            {widgets.length === 0 ? (
              <EmptyState
                icon={LayoutGrid}
                title="No widgets yet"
                description="Add a widget from the palette to start building this page."
              />
            ) : (
              <ul className="space-y-2">
                {widgets.map((w) => (
                  <li
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    className={`p-3 border rounded-[var(--st-radius)] cursor-pointer transition-colors ${
                      selectedId === w.id
                        ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                        : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--st-text)]">
                          {w.kind}
                        </div>
                        <div className="text-xs text-[var(--st-text-secondary)] truncate">
                          {Object.keys(w.config ?? {}).length === 0
                            ? 'no config'
                            : Object.keys(w.config).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconButton
                          label="Move widget up"
                          icon={ArrowUp}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(w.id, -1);
                          }}
                        />
                        <IconButton
                          label="Move widget down"
                          icon={ArrowDown}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(w.id, 1);
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </main>

        <aside className="space-y-4">
          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Widget properties
              </CardTitle>
            </CardHeader>
            {selected ? (
              <div className="space-y-3">
                <Field label="Widget id">
                  <Input
                    value={selected.id}
                    onChange={(e) => updateSelected({ id: e.target.value })}
                  />
                </Field>
                <Field label="Config (JSON)">
                  <Textarea
                    rows={6}
                    value={JSON.stringify(selected.config ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateSelected({
                          config:
                            parsed && typeof parsed === 'object' ? parsed : {},
                        });
                      } catch {
                        // ignore until valid JSON
                      }
                    }}
                  />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={removeSelected}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[var(--st-text-secondary)]">
                Select a widget on the canvas to edit it.
              </p>
            )}
          </Card>

          <Card padding="sm">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Visibility
              </CardTitle>
            </CardHeader>
            <Field label="Who can see this page">
              <Select
                value={roleVisibility}
                onValueChange={(v) =>
                  setRoleVisibility(v as SabcreatorPageRoleVisibility)
                }
              >
                <SelectTrigger aria-label="Page visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="admin">Admins only</SelectItem>
                  <SelectItem value="specific">Specific roles</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Card>
        </aside>
      </div>
    </div>
  );
}
