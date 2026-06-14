/**
 * Semantic models catalog — the SabBI metrics layer browse surface.
 *
 * Lists governed models (measures/dimensions/joins/segments) and a flattened
 * "metrics catalog" of every measure defined across them. Real data via
 * `listModelsAction` (Rust `sabbi-semantic`).
 */
import Link from 'next/link';
import {
  Boxes,
  Gauge,
  Layers,
  Plug,
  Ruler,
  Sigma,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { getGovernanceMapAction } from '@/app/actions/sabbi-governance.actions';
import { listModelsAction } from '@/app/actions/sabbi-models.actions';
import type { Governance } from '@/lib/sabbi/governance.server';

import { NewModelButton } from './_components/new-model-button';

export const dynamic = 'force-dynamic';

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function ModelsPage() {
  let models: Awaited<ReturnType<typeof listModelsAction>>['items'] = [];
  let gov: Record<string, Governance> = {};
  try {
    const [m, g] = await Promise.all([listModelsAction({ limit: 200 }), getGovernanceMapAction()]);
    models = m.items;
    gov = g;
  } catch {
    models = [];
  }

  const totalMeasures = models.reduce((a, m) => a + (m.measures?.length ?? 0), 0);
  const totalDimensions = models.reduce((a, m) => a + (m.dimensions?.length ?? 0), 0);
  const connectorCount = new Set(models.map((m) => m.connector).filter(Boolean)).size;

  // Flattened metrics catalog: every measure across every model.
  const catalog = models.flatMap((m) =>
    (m.measures ?? []).map((meas) => ({ model: m, meas })),
  );

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI · Semantic layer</PageEyebrow>
          <PageTitle>Models &amp; metrics</PageTitle>
          <PageDescription>
            Define measures, dimensions, joins, and segments once — then reuse
            them across charts, dashboards, embeds, and the AI copilot.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <NewModelButton />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-[var(--st-space-4)] sm:grid-cols-4">
        <StatCard label="Models" value={models.length} icon={Boxes} accent="var(--st-accent)" />
        <StatCard label="Measures" value={totalMeasures} icon={Sigma} />
        <StatCard label="Dimensions" value={totalDimensions} icon={Ruler} />
        <StatCard label="Connectors" value={connectorCount} icon={Plug} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers size={16} aria-hidden="true" />
            Models
          </CardTitle>
        </CardHeader>
        <CardBody>
          {models.length === 0 ? (
            <EmptyState
              icon={Layers}
              tone="info"
              title="No models yet"
              description="Create a model over a collection, or connect a SabNode module (P2) to seed one with measures and dimensions."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Collection</Th>
                  <Th align="right">Measures</Th>
                  <Th align="right">Dimensions</Th>
                  <Th align="left">Source</Th>
                  <Th align="left">Updated</Th>
                </Tr>
              </THead>
              <TBody>
                {models.map((m) => (
                  <Tr key={m._id}>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <Link
                          href={`/dashboard/sabbi/models/${m._id}`}
                          className="font-medium text-[var(--st-text)] hover:underline"
                        >
                          {m.name}
                        </Link>
                        {gov[m._id]?.verified && <Badge tone="success">Verified</Badge>}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                      {m.collection}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {m.measures?.length ?? 0}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {m.dimensions?.length ?? 0}
                    </Td>
                    <Td>
                      {m.connector ? (
                        <Badge tone="info">
                          <Plug size={12} aria-hidden="true" />
                          {m.connector}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">manual</Badge>
                      )}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{relativeTime(m.updatedAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {catalog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sigma size={16} aria-hidden="true" />
              Metrics catalog
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Measure</Th>
                  <Th align="left">Aggregation</Th>
                  <Th align="left">Format</Th>
                  <Th align="left">Model</Th>
                </Tr>
              </THead>
              <TBody>
                {catalog.map(({ model, meas }) => (
                  <Tr key={`${model._id}:${meas.key}`}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Gauge size={13} aria-hidden="true" />
                        <span className="font-medium">{meas.label}</span>
                        <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                          {meas.key}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        {meas.agg}
                        {meas.column ? ` · ${meas.column}` : ''}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{meas.format ?? '—'}</Td>
                    <Td>
                      <Link
                        href={`/dashboard/sabbi/models/${model._id}`}
                        className="text-[var(--st-text-secondary)] hover:underline"
                      >
                        {model.name}
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
