'use client';

import * as React from 'react';
import { Columns3 } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getLeadPipelineStages,
  getLeadPipelines,
  saveLeadPipelineStage,
  deleteLeadPipelineStage,
} from '@/app/actions/worksuite/crm-plus.actions';
import type {
  WsLeadPipeline,
  WsLeadPipelineStage,
} from '@/lib/worksuite/crm-types';

export default function LeadPipelineStagesPage() {
  const [pipelines, setPipelines] = React.useState<WsLeadPipeline[]>([]);
  const [pipelineFilter, setPipelineFilter] = React.useState<string>('');

  React.useEffect(() => {
    (async () => {
      const list = await getLeadPipelines();
      setPipelines(list as unknown as WsLeadPipeline[]);
    })();
  }, []);

  const getAllFiltered = React.useCallback(async () => {
    const list = (await getLeadPipelineStages()) as unknown as (WsLeadPipelineStage & {
      _id: string;
    })[];
    if (!pipelineFilter) return list;
    return list.filter((s) => String(s.pipeline_id) === pipelineFilter);
  }, [pipelineFilter]);

  const pipelineOptions = pipelines.map((p) => ({
    value: String(p._id),
    label: p.name,
  }));
  const pipelineLookup = new Map(pipelineOptions.map((p) => [p.value, p.label]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label
          htmlFor="pipeline-filter"
          className="text-[12px] text-clay-ink-muted"
        >
          Filter by pipeline:
        </label>
        <select
          id="pipeline-filter"
          value={pipelineFilter}
          onChange={(e) => setPipelineFilter(e.target.value)}
          className="h-9 rounded-clay-md border border-clay-border bg-clay-surface px-2 text-[13px] text-clay-ink"
        >
          <option value="">All</option>
          {pipelineOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <HrEntityPage<WsLeadPipelineStage & { _id: string }>
        key={pipelineFilter}
        title="Pipeline Stages"
        subtitle="Ordered stages inside each pipeline (kanban columns)."
        icon={Columns3}
        singular="Stage"
        getAllAction={getAllFiltered as any}
        saveAction={saveLeadPipelineStage}
        deleteAction={deleteLeadPipelineStage}
        columns={[
          { key: 'name', label: 'Stage' },
          {
            key: 'pipeline_id',
            label: 'Pipeline',
            render: (row) =>
              pipelineLookup.get(String(row.pipeline_id)) || '—',
          },
          { key: 'slug', label: 'Slug' },
          { key: 'priority', label: 'Order' },
          {
            key: 'label_color',
            label: 'Color',
            render: (row) => {
              const color = row.label_color || '#64748b';
              return (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-clay-border"
                    style={{ backgroundColor: color }}
                  />
                  <ClayBadge
                    tone="neutral"
                    style={{
                      backgroundColor: color + '20',
                      color,
                      borderColor: color + '40',
                    }}
                  >
                    {color}
                  </ClayBadge>
                </span>
              );
            },
          },
        ]}
        fields={[
          {
            name: 'pipeline_id',
            label: 'Pipeline',
            type: 'select',
            required: true,
            options: pipelineOptions,
          },
          { name: 'name', label: 'Stage Name', required: true },
          { name: 'slug', label: 'Slug', placeholder: 'qualified' },
          {
            name: 'priority',
            label: 'Order',
            type: 'number',
            defaultValue: '0',
          },
          {
            name: 'label_color',
            label: 'Label Color (hex)',
            placeholder: '#64748b',
            defaultValue: '#64748b',
          },
        ]}
      />
    </div>
  );
}
