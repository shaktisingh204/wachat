'use client';

import { Button, Card, Input, Label } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';

import { Trash2, Plus, ArrowLeft, Columns3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

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
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link href="/dashboard/sabbigin/pipelines" className="inline-flex items-center gap-2 text-[13px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
          <ArrowLeft className="h-4 w-4" /> Back to Pipelines
        </Link>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--st-text)] flex items-center gap-3">
          <Columns3 className="h-6 w-6 text-[var(--st-text)]" />
          Create New Pipeline
        </h1>
      </div>

      <Card>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name" className="text-[var(--st-text)]">Pipeline Name</Label>
            <Input
              id="pipeline-name"
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[var(--st-text)]">Description</Label>
            <Input
              id="description"
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Edit Pipeline Stages</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`stage-name-${index}`} className="text-xs text-[var(--st-text-secondary)]">Stage Name</Label>
                  <Input
                    id={`stage-name-${index}`}
                    className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                    value={stage.name}
                    onChange={e => handleStageChange(stage.id, 'name', e.target.value)}
                  />
                </div>
                <div className="w-32 space-y-1">
                  <Label htmlFor={`stage-chance-${index}`} className="text-xs text-[var(--st-text-secondary)]">Closure Chances (%)</Label>
                  <Input
                    id={`stage-chance-${index}`}
                    type="number"
                    className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                    value={stage.chance}
                    onChange={e => handleStageChange(stage.id, 'chance', Number(e.target.value))}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveStage(stage.id)}
                  className="self-end mb-1"
                >
                  <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddStage}>
            Add New Stage
          </Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </Card>
    </div>
  );
}
