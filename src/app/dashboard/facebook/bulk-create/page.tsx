'use client';

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, FileUploadCard, Input, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, StatCard, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
  } from 'lucide-react';

import { bulkCreatePosts } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/bulk-create — Bulk Facebook post creator (Ui20).
 *
 * `FileUploadCard` for CSV upload, editable preview table, and a
 * confirm-send `AlertDialog` before dispatching `bulkCreatePosts`.
 * No tab UI — manual entry and CSV upload sit side by side as
 * collapsible cards.
 */

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';

type PostRow = { message: string; imageUrl: string; scheduledTime: string };

const blankRow = (): PostRow => ({
  message: '',
  imageUrl: '',
  scheduledTime: '',
});

export default function BulkCreatePage() {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [rows, setRows] = useState<PostRow[]>([blankRow()]);
  const [isPublishing, startPublish] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    successCount: number;
    failCount: number;
  } | null>(null);

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const addRow = useCallback(
    () => setRows((prev) => [...prev, blankRow()]),
    [],
  );
  const removeRow = useCallback(
    (i: number) =>
      setRows((prev) =>
        prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
      ),
    [],
  );
  const updateRow = useCallback(
    (i: number, field: keyof PostRow, value: string) =>
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
      ),
    [],
  );

  const parseCsv = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
          toast({
            title: 'Empty CSV',
            description: 'Need a header row plus at least one data row.',
            variant: 'destructive',
          });
          return;
        }
        const headers = lines[0]
          .split(',')
          .map((h) => h.trim().toLowerCase().replace(/"/g, ''));
        const msgIdx = headers.findIndex(
          (h) => h === 'message' || h === 'text' || h === 'content',
        );
        const imgIdx = headers.findIndex(
          (h) => h === 'image_url' || h === 'imageurl' || h === 'image',
        );
        const timeIdx = headers.findIndex(
          (h) =>
            h === 'scheduled_time' ||
            h === 'scheduledtime' ||
            h === 'schedule',
        );

        if (msgIdx === -1) {
          toast({
            title: 'Missing column',
            description: 'CSV must have a "message" column.',
            variant: 'destructive',
          });
          return;
        }

        const parsed: PostRow[] = [];
        for (let i = 1; i < lines.length; i += 1) {
          const vals = lines[i]
            .split(',')
            .map((v) => v.trim().replace(/"/g, ''));
          const msg = vals[msgIdx] || '';
          if (!msg) continue;
          parsed.push({
            message: msg,
            imageUrl: imgIdx >= 0 ? vals[imgIdx] || '' : '',
            scheduledTime: timeIdx >= 0 ? vals[timeIdx] || '' : '',
          });
        }
        if (parsed.length > 0) {
          setRows(parsed);
          toast({
            title: `Parsed ${parsed.length} posts`,
            description: 'Review the preview table and edit before sending.',
          });
        }
      };
      reader.readAsText(file);
    },
    [toast],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) parseCsv(file);
    },
    [parseCsv],
  );

  const validCount = useMemo(
    () => rows.filter((r) => r.message.trim()).length,
    [rows],
  );
  const scheduledCount = useMemo(
    () =>
      rows.filter((r) => r.message.trim() && r.scheduledTime).length,
    [rows],
  );

  const runPublish = useCallback(() => {
    if (!projectId) return;
    const validPosts = rows.filter((r) => r.message.trim());
    if (validPosts.length === 0) {
      toast({
        title: 'Nothing to publish',
        description: 'Add at least one post with a message.',
        variant: 'destructive',
      });
      setConfirmOpen(false);
      return;
    }
    startPublish(async () => {
      const res = await bulkCreatePosts(
        projectId,
        validPosts.map((p) => ({
          message: p.message,
          imageUrl: p.imageUrl || undefined,
          scheduledTime: p.scheduledTime || undefined,
        })),
      );
      if (res.error) {
        toast({
          title: 'Bulk publish failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        setResult({
          successCount: res.successCount,
          failCount: res.failCount,
        });
        toast({
          title: 'Bulk publish complete',
          description: `${res.successCount} succeeded, ${res.failCount} failed.`,
        });
      }
      setConfirmOpen(false);
    });
  }, [projectId, rows, toast]);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bulk create</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Tools</PageEyebrow>
          <PageTitle>Bulk post creator</PageTitle>
          <PageDescription>
            Upload a CSV or hand-author multiple posts and publish them in one
            batch. Optional schedule and image URL per row.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus /> Add row
          </Button>
          <Button
            size="sm"
            disabled={validCount === 0 || isPublishing}
            onClick={() => setConfirmOpen(true)}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send />
            )}
            Publish {validCount > 0 ? `${validCount} post${validCount === 1 ? '' : 's'}` : ''}
          </Button>
        </PageActions>
      </PageHeader>

      {!projectId ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Select a project from the dashboard to use bulk create.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {result ? (
            <Alert
              variant={result.failCount === 0 ? 'success' : 'warning'}
              className="mt-6"
            >
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Bulk publish complete</AlertTitle>
              <AlertDescription>
                {result.successCount} succeeded, {result.failCount} failed.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard
              label="Rows"
              value={rows.length.toLocaleString()}
              period="In editor"
              icon={<FileUp />}
            />
            <StatCard
              label="Valid posts"
              value={validCount.toLocaleString()}
              period="With message text"
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Scheduled"
              value={scheduledCount.toLocaleString()}
              period="With future time"
              icon={<Send />}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="p-0">
              <CardHeader>
                <CardTitle className="text-base">
                  Upload CSV
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                  CSV must have a <code>message</code> column. Optional
                  columns: <code>image_url</code>, <code>scheduled_time</code>.
                </p>
                <FileUploadCard
                  accept=".csv,text/csv"
                  multiple={false}
                  onFilesSelected={handleFiles}
                  hint="Drop a .csv file or click to browse"
                />
              </CardBody>
            </Card>

            <Card className="p-0">
              <CardHeader>
                <CardTitle className="text-base">
                  Manual entry
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Add a row at a time. Each post must have a non-empty
                  message; image URL and schedule are optional.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={addRow}>
                    <Plus /> Add row
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRows([blankRow()])}
                  >
                    <Trash2 /> Reset rows
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6 p-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2">
                  Posts preview
                  <Badge variant="outline">
                    {validCount} valid / {rows.length} rows
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {rows.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Upload />}
                  title="No rows"
                  description="Upload a CSV or add a row to start."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <Tr>
                        <Th className="w-8">#</Th>
                        <Th>Message</Th>
                        <Th className="w-[220px]">
                          Image URL
                        </Th>
                        <Th className="w-[200px]">
                          Schedule
                        </Th>
                        <Th className="w-12" />
                      </Tr>
                    </THead>
                    <TBody>
                      {rows.map((row, i) => (
                        <Tr key={i}>
                          <Td className="text-[var(--st-text-secondary)]">
                            {i + 1}
                          </Td>
                          <Td>
                            <Textarea
                              value={row.message}
                              onChange={(e) =>
                                updateRow(i, 'message', e.target.value)
                              }
                              placeholder="Post message…"
                              className="min-h-9"
                              rows={2}
                            />
                          </Td>
                          <Td>
                            <SabFileUrlInput
                              accept="image"
                              value={row.imageUrl}
                              onChange={(v) => updateRow(i, 'imageUrl', v)}
                              placeholder="https://…"
                            />
                          </Td>
                          <Td>
                            <Input
                              type="datetime-local"
                              value={row.scheduledTime}
                              onChange={(e) =>
                                updateRow(i, 'scheduledTime', e.target.value)
                              }
                            />
                          </Td>
                          <Td>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeRow(i)}
                              disabled={rows.length <= 1}
                              aria-label="Remove row"
                            >
                              <Trash2 />
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* ── Confirm bulk send ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Publish {validCount} post{validCount === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {scheduledCount > 0
                ? `${scheduledCount} will be scheduled for a future time, ${
                    validCount - scheduledCount
                  } will publish immediately.`
                : 'All posts will publish immediately to the connected Facebook Page.'}{' '}
              This action cannot be undone in bulk — you will need to delete
              individual posts to roll back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={runPublish}
              disabled={isPublishing || validCount === 0}
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
