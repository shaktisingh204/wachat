'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowLeft, Columns3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

import { ClayButton, ClayCard } from '@/components/clay';

type Stage = {
  id: string;
  name: string;
  chance: number;
};

const defaultStages: Stage[] = [
  { id: uuidv4(), name: 'Open', chance: 10 },
  { id: uuidv4(), name: 'Contacted', chance: 20 },
  { id: uuidv4(), name: 'Proposal Sent', chance: 50 },
  { id: uuidv4(), name: 'Deal Done', chance: 100 },
  { id: uuidv4(), name: 'Lost', chance: 0 },
  { id: uuidv4(), name: 'Not Serviceable', chance: 0 },
];

export default function NewPipelinePage() {
  const [pipelineName, setPipelineName] = useState('Sales Pipeline');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<Stage[]>(defaultStages);

  const handleStageChange = (id: string, field: 'name' | 'chance', value: string | number) => {
    setStages(prevStages =>
      prevStages.map(stage =>
        stage.id === id ? { ...stage, [field]: value } : stage
      )
    );
  };

  const handleAddStage = () => {
    setStages(prev => [...prev, { id: uuidv4(), name: 'New Stage', chance: 0 }]);
  };

  const handleRemoveStage = (id: string) => {
    setStages(prev => prev.filter(stage => stage.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto flex w-full flex-col gap-6">
      <div>
        <Link href="/dashboard/crm/sales-crm/pipelines" className="inline-flex items-center gap-2 text-[13px] text-clay-ink-muted hover:text-clay-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Pipelines
        </Link>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-clay-ink flex items-center gap-3">
          <Columns3 className="h-6 w-6 text-clay-rose-ink" />
          Create New Pipeline
        </h1>
      </div>

      <ClayCard>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name" className="text-clay-ink">Pipeline Name</Label>
            <Input
              id="pipeline-name"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-clay-ink">Description</Label>
            <Input
              id="description"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-clay-ink">Edit Pipeline Stages</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-4 rounded-clay-md border border-clay-border bg-clay-surface-2 p-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`stage-name-${index}`} className="text-xs text-clay-ink-muted">Stage Name</Label>
                  <Input
                    id={`stage-name-${index}`}
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    value={stage.name}
                    onChange={e => handleStageChange(stage.id, 'name', e.target.value)}
                  />
                </div>
                <div className="w-32 space-y-1">
                  <Label htmlFor={`stage-chance-${index}`} className="text-xs text-clay-ink-muted">Closure Chances (%)</Label>
                  <Input
                    id={`stage-chance-${index}`}
                    type="number"
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    value={stage.chance}
                    onChange={e => handleStageChange(stage.id, 'chance', Number(e.target.value))}
                  />
                </div>
                <ClayButton
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveStage(stage.id)}
                  className="self-end mb-1"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </ClayButton>
              </div>
            ))}
          </div>
          <ClayButton variant="pill" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />} onClick={handleAddStage}>
            Add New Stage
          </ClayButton>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <ClayButton variant="ghost">Cancel</ClayButton>
          <ClayButton variant="obsidian">Save Changes</ClayButton>
        </div>
      </ClayCard>
    </div>
  );
}
