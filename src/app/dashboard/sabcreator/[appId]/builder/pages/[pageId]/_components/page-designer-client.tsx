'use client';

/**
 * SabCreator page designer.
 *
 * Left: widget palette (KPI, List view, Chart, Form embed, Button, Text).
 * Center: drop zones — vertical stack of widgets, reorderable.
 * Right: widget properties + page-level role visibility.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ListIcon,
  MousePointerClick,
  PieChart,
  Save,
  SquareDashed,
  Trash2,
  Type as TypeIcon,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import { updateSabcreatorPage } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type {
  SabcreatorPageDoc,
  SabcreatorPageRoleVisibility,
  SabcreatorPageWidget,
} from '@/lib/rust-client/sabcreator-pages';

type WidgetKind = 'kpi' | 'listView' | 'chart' | 'formEmbed' | 'button' | 'text';

const PALETTE: Array<{ kind: WidgetKind; label: string; icon: React.ReactNode }> = [
  { kind: 'kpi', label: 'KPI card', icon: <PieChart className="size-4" /> },
  { kind: 'listView', label: 'List view', icon: <ListIcon className="size-4" /> },
  { kind: 'chart', label: 'Chart', icon: <BarChart3 className="size-4" /> },
  { kind: 'formEmbed', label: 'Form embed', icon: <SquareDashed className="size-4" /> },
  { kind: 'button', label: 'Button', icon: <MousePointerClick className="size-4" /> },
  { kind: 'text', label: 'Text', icon: <TypeIcon className="size-4" /> },
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
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] savePage failed', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <div>
          <ZoruPageTitle>{page.name}</ZoruPageTitle>
          <ZoruPageDescription>
            Page designer · {page.kind} ·{' '}
            <Link
              href={`/dashboard/sabcreator/${app._id}/builder`}
              className="underline"
            >
              back to builder
            </Link>
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Badge variant="outline">{page.status}</Badge>
          <Button onClick={save} disabled={pending}>
            <Save className="size-4" /> {pending ? 'Saving…' : 'Save'}
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[200px_1fr_320px] gap-4 px-6 pb-10">
        <aside>
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-zoru-ink-muted mb-2">
              WIDGETS
            </h3>
            <div className="space-y-1">
              {PALETTE.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  onClick={() => addWidget(p.kind)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left hover:bg-zoru-surface-2"
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <main>
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-zoru-ink-muted mb-3">
              CANVAS · {page.kind}
            </h3>
            {widgets.length === 0 ? (
              <div className="text-sm text-zoru-ink-muted py-8 text-center">
                Add a widget from the palette.
              </div>
            ) : (
              <ul className="space-y-2">
                {widgets.map((w) => (
                  <li
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedId === w.id
                        ? 'border-primary bg-zoru-ink/5'
                        : 'hover:bg-zoru-surface-2/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{w.kind}</div>
                        <div className="text-xs text-zoru-ink-muted truncate">
                          {Object.keys(w.config ?? {}).length === 0
                            ? 'no config'
                            : Object.keys(w.config).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(w.id, -1);
                          }}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(w.id, 1);
                          }}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </main>

        <aside className="space-y-4">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-zoru-ink-muted mb-2">
              WIDGET PROPERTIES
            </h3>
            {selected ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Widget id</Label>
                  <Input
                    value={selected.id}
                    onChange={(e) => updateSelected({ id: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Config (JSON)</Label>
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
                </div>
                <Button variant="outline" size="sm" onClick={removeSelected}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            ) : (
              <div className="text-xs text-zoru-ink-muted">
                Select a widget on the canvas to edit it.
              </div>
            )}
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-zoru-ink-muted mb-2">
              VISIBILITY
            </h3>
            <Select
              value={roleVisibility}
              onValueChange={(v) =>
                setRoleVisibility(v as SabcreatorPageRoleVisibility)
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All users</ZoruSelectItem>
                <ZoruSelectItem value="admin">Admins only</ZoruSelectItem>
                <ZoruSelectItem value="specific">Specific roles</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </Card>
        </aside>
      </div>
    </div>
  );
}
