'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createJoinAction } from '@/app/actions/analytics-bi.actions';
import type { BiJoinType } from '@/lib/rust-client/bi-dataset-joins';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';

interface DatasetRef {
  id: string;
  name: string;
}

interface OnRow {
  left: string;
  right: string;
}

export function JoinBuilder({ datasets }: { datasets: DatasetRef[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [leftId, setLeftId] = useState<string>(datasets[0]?.id ?? '');
  const [rightId, setRightId] = useState<string>(datasets[1]?.id ?? datasets[0]?.id ?? '');
  const [joinType, setJoinType] = useState<BiJoinType>('inner');
  const [rows, setRows] = useState<OnRow[]>([{ left: '', right: '' }]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateRow(idx: number, side: 'left' | 'right', value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [side]: value } : r)),
    );
  }

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!leftId || !rightId) {
      setError('Pick both datasets');
      return;
    }
    const onColumns = rows
      .map((r) => ({ left: r.left.trim(), right: r.right.trim() }))
      .filter((r) => r.left && r.right);
    if (onColumns.length === 0) {
      setError('Add at least one column mapping');
      return;
    }
    startTransition(async () => {
      try {
        await createJoinAction({
          name: name.trim(),
          leftId,
          rightId,
          type: joinType,
          onColumns,
        });
        setName('');
        setRows([{ left: '', right: '' }]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save join');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New join</CardTitle>
        <CardDescription>
          Pick two datasets, choose the join type, and map matching columns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="join-name">Name</Label>
            <Input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orders + Customers"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="join-type">Type</Label>
            <Select value={joinType} onValueChange={(v) => setJoinType(v as BiJoinType)}>
              <ZoruSelectTrigger id="join-type">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="inner">Inner</ZoruSelectItem>
                <ZoruSelectItem value="left">Left</ZoruSelectItem>
                <ZoruSelectItem value="right">Right</ZoruSelectItem>
                <ZoruSelectItem value="outer">Outer</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Left dataset</Label>
            <Select value={leftId} onValueChange={setLeftId}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Pick a dataset" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {datasets.map((d) => (
                  <ZoruSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Right dataset</Label>
            <Select value={rightId} onValueChange={setRightId}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Pick a dataset" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {datasets.map((d) => (
                  <ZoruSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Label>Column mapping</Label>
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <Input
                value={r.left}
                onChange={(e) => updateRow(idx, 'left', e.target.value)}
                placeholder="left column"
              />
              <span className="text-[var(--st-text-secondary)]">=</span>
              <Input
                value={r.right}
                onChange={(e) => updateRow(idx, 'right', e.target.value)}
                placeholder="right column"
              />
              <Button
                variant="ghost"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                disabled={rows.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="ghost"
              onClick={() => setRows((prev) => [...prev, { left: '', right: '' }])}
            >
              Add column
            </Button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--st-danger)]">{error}</p>}

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Save join'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
