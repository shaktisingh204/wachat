'use client';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';

import { Trash2, ArrowLeft, Columns3 } from 'lucide-react';
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
    <div className="ui20 flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/sabbigin/pipelines"
          className="inline-flex w-fit items-center gap-2 text-[13px] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Pipelines
        </Link>
        <PageHeader bordered={false} compact>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              <Columns3 className="h-6 w-6" aria-hidden="true" />
              Create New Pipeline
            </PageTitle>
          </PageHeaderHeading>
        </PageHeader>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-6">
          <Field label="Pipeline Name">
            <Input
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Pipeline Stages</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {stages.map(stage => (
              <div
                key={stage.id}
                className="flex items-end gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
              >
                <Field label="Stage Name" className="flex-1">
                  <Input
                    value={stage.name}
                    onChange={e => handleStageChange(stage.id, 'name', e.target.value)}
                  />
                </Field>
                <Field label="Closure Chances (%)" className="w-32">
                  <Input
                    type="number"
                    value={stage.chance}
                    onChange={e => handleStageChange(stage.id, 'chance', Number(e.target.value))}
                  />
                </Field>
                <IconButton
                  label={`Remove ${stage.name} stage`}
                  icon={Trash2}
                  variant="ghost"
                  onClick={() => handleRemoveStage(stage.id)}
                />
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddStage}>
            Add New Stage
          </Button>
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
