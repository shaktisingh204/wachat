'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createDatasetAction } from '@/app/actions/analytics-bi.actions';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
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
  Textarea,
} from '@/components/sabcrm/20ui/compat';

type Source = 'csv_upload' | 'mongo_collection' | 'rest_api';

/**
 * Connect-source panel. Uses `<SabFilePickerButton>` for CSV upload —
 * we do NOT expose a URL paste for files. REST endpoints have their own
 * `restUrl` input which is a saved API endpoint, not a file source.
 */
export function NewDatasetPanel() {
  const router = useRouter();
  const [source, setSource] = useState<Source>('csv_upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filePick, setFilePick] = useState<SabFilePick | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [restUrl, setRestUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (source === 'csv_upload' && !filePick?.fileId) {
      setError('Pick a CSV from SabFiles');
      return;
    }
    if (source === 'mongo_collection' && !collectionName.trim()) {
      setError('Collection name is required');
      return;
    }
    if (source === 'rest_api' && !restUrl.trim()) {
      setError('REST URL is required');
      return;
    }
    startTransition(async () => {
      try {
        await createDatasetAction({
          name: name.trim(),
          description: description.trim() || undefined,
          source,
          fileId: source === 'csv_upload' ? filePick?.fileId : undefined,
          collectionName:
            source === 'mongo_collection' ? collectionName.trim() : undefined,
          restUrl: source === 'rest_api' ? restUrl.trim() : undefined,
        });
        setName('');
        setDescription('');
        setFilePick(null);
        setCollectionName('');
        setRestUrl('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create dataset');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect a data source</CardTitle>
        <CardDescription>
          CSV uploads live in SabFiles. System collections are scoped to your
          tenant; REST endpoints are stored as saved URLs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ds-name">Name</Label>
            <Input
              id="ds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales 2026"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-source">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <ZoruSelectTrigger id="ds-source">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="csv_upload">CSV (SabFiles)</ZoruSelectItem>
                <ZoruSelectItem value="mongo_collection">System collection</ZoruSelectItem>
                <ZoruSelectItem value="rest_api">REST endpoint</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>

          {source === 'csv_upload' && (
            <div className="grid gap-1.5 md:col-span-2">
              <Label>CSV file</Label>
              <SabFilePickerButton
                accept="text/csv"
                onPick={setFilePick}
                value={filePick ?? undefined}
                placeholder="Pick a CSV from SabFiles"
              />
            </div>
          )}

          {source === 'mongo_collection' && (
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="ds-coll">Collection name</Label>
              <Input
                id="ds-coll"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="crm_deals"
              />
            </div>
          )}

          {source === 'rest_api' && (
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="ds-rest">REST URL</Label>
              <Input
                id="ds-rest"
                value={restUrl}
                onChange={(e) => setRestUrl(e.target.value)}
                placeholder="https://api.example.com/rows"
              />
            </div>
          )}

          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="ds-desc">Description (optional)</Label>
            <Textarea
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--st-danger)]">{error}</p>}

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Add dataset'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
