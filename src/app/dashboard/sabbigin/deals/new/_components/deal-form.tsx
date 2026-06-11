'use client';

/**
 * SabBigin — New deal form (client).
 *
 * Controlled form posting through `createSabbiginDeal`, which returns the
 * new `dealId` so we can route straight to the detail page. Pipeline and
 * stage are dependent selects; `?pipeline=` / `?stage=` preselect them.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Field,
  Input,
  Textarea,
  SelectField,
  toast,
} from '@/components/sabcrm/20ui';

import { createSabbiginDeal } from '@/app/actions/sabbigin-deals.actions';

export interface DealFormStage {
  id: string;
  name: string;
  probability: number | null;
}

export interface DealFormPipeline {
  id: string;
  name: string;
  stages: DealFormStage[];
}

export interface DealFormProps {
  pipelines: DealFormPipeline[];
  initialPipelineId?: string | null;
  initialStage?: string | null;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function DealForm({
  pipelines,
  initialPipelineId,
  initialStage,
}: DealFormProps): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const firstPipeline = pipelines[0];
  const initialPipeline =
    pipelines.find((p) => p.id === initialPipelineId) ?? firstPipeline;

  const [pipelineId, setPipelineId] = React.useState<string>(initialPipeline?.id ?? '');
  const activePipeline = React.useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  );

  const initialStageName =
    activePipeline?.stages.find((s) => s.name === initialStage)?.name ??
    activePipeline?.stages[0]?.name ??
    '';
  const [stage, setStage] = React.useState<string>(initialStageName);

  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [probability, setProbability] = React.useState('');
  const [closeDate, setCloseDate] = React.useState('');
  const [priority, setPriority] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);

  // When the pipeline changes, reset the stage to its first stage.
  const onPipelineChange = React.useCallback(
    (next: string | null) => {
      const pid = next ?? '';
      setPipelineId(pid);
      const p = pipelines.find((x) => x.id === pid);
      setStage(p?.stages[0]?.name ?? '');
    },
    [pipelines],
  );

  const stageOptions = React.useMemo(
    () =>
      (activePipeline?.stages ?? []).map((s) => ({
        value: s.name,
        label: s.probability != null ? `${s.name} · ${s.probability}%` : s.name,
      })),
    [activePipeline],
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setNameError('Deal name is required.');
        return;
      }
      setNameError(null);
      startTransition(async () => {
        const r = await createSabbiginDeal({
          name: trimmed,
          value: value === '' ? 0 : Number(value),
          currency,
          stage,
          pipelineId,
          probability: probability === '' ? null : Number(probability),
          closeDate: closeDate || null,
          priority: (priority as 'low' | 'medium' | 'high' | 'critical' | null) ?? null,
          description: description || null,
        });
        if (!r.success || !r.dealId) {
          toast.error({ title: 'Could not create deal', description: r.error });
          return;
        }
        toast.success({ title: 'Deal created' });
        router.push(`/dashboard/sabbigin/deals/${r.dealId}`);
      });
    },
    [
      name,
      value,
      currency,
      stage,
      pipelineId,
      probability,
      closeDate,
      priority,
      description,
      router,
    ],
  );

  return (
    <form onSubmit={handleSubmit}>
      <Card padding="none" className="max-w-3xl">
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Deal name" required error={nameError ?? undefined}>
                <Input
                  value={name}
                  autoFocus
                  placeholder="e.g. Acme Corp — annual plan"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                />
              </Field>
            </div>

            <Field label="Pipeline" required>
              <SelectField
                value={pipelineId}
                onChange={onPipelineChange}
                options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Select pipeline"
              />
            </Field>

            <Field label="Stage" required>
              <SelectField
                value={stage}
                onChange={(v) => setStage(v ?? '')}
                options={stageOptions}
                placeholder="Select stage"
              />
            </Field>

            <Field label="Deal value">
              <Input
                type="number"
                inputMode="decimal"
                prefix={currency}
                value={value}
                placeholder="0"
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>

            <Field label="Currency">
              <SelectField
                value={currency}
                onChange={(v) => setCurrency(v ?? 'INR')}
                options={[
                  { value: 'INR', label: 'INR — Indian Rupee' },
                  { value: 'USD', label: 'USD — US Dollar' },
                  { value: 'EUR', label: 'EUR — Euro' },
                  { value: 'GBP', label: 'GBP — British Pound' },
                  { value: 'AED', label: 'AED — UAE Dirham' },
                ]}
              />
            </Field>

            <Field label="Probability" help="0–100% chance of winning.">
              <Input
                type="number"
                min={0}
                max={100}
                suffix="%"
                value={probability}
                placeholder="—"
                onChange={(e) => setProbability(e.target.value)}
              />
            </Field>

            <Field label="Expected close date">
              <Input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </Field>

            <Field label="Priority">
              <SelectField
                value={priority}
                onChange={setPriority}
                options={PRIORITIES}
                placeholder="Set priority"
                clearable
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={description}
                  placeholder="What is this deal about?"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/sabbigin/deals')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={pending}
            iconLeft={<Save size={14} />}
          >
            Create deal
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default DealForm;
