'use client';

import {
  Dialog,
  ZoruDialogContent as DialogContent,
  ZoruDialogDescription as DialogDescription,
  ZoruDialogHeader as DialogHeader,
  ZoruDialogTitle as DialogTitle,
  ZoruDialogTrigger as DialogTrigger,
  Button,
  Badge,
} from '@/components/zoruui';
import { SeoPageAudit } from '@/lib/seo/definitions';
import { ArrowRight, CheckCircle, AlertCircle, FilePlus, FileMinus } from 'lucide-react';
import { useMemo } from 'react';

type ClientSeoPageAudit = Omit<SeoPageAudit, 'crawledAt'> & { crawledAt: string | Date };

interface AuditDiffViewerProps {
  currentPages: ClientSeoPageAudit[];
  pastPages: ClientSeoPageAudit[];
}

export function AuditDiffViewer({ currentPages, pastPages }: AuditDiffViewerProps) {
  const diff = useMemo(() => {
    const currentMap = new Map(currentPages.map(p => [p.url, p]));
    const pastMap = new Map(pastPages.map(p => [p.url, p]));

    const newPages: ClientSeoPageAudit[] = [];
    const removedPages: ClientSeoPageAudit[] = [];
    const improvedPages: { url: string; oldIssues: number; newIssues: number }[] = [];
    const degradedPages: { url: string; oldIssues: number; newIssues: number }[] = [];

    currentPages.forEach(current => {
      const past = pastMap.get(current.url);
      if (!past) {
        newPages.push(current);
      } else {
        const oldIssuesCount = past.issues?.length || 0;
        const newIssuesCount = current.issues?.length || 0;
        if (newIssuesCount < oldIssuesCount) {
          improvedPages.push({ url: current.url, oldIssues: oldIssuesCount, newIssues: newIssuesCount });
        } else if (newIssuesCount > oldIssuesCount) {
          degradedPages.push({ url: current.url, oldIssues: oldIssuesCount, newIssues: newIssuesCount });
        }
      }
    });

    pastPages.forEach(past => {
      if (!currentMap.has(past.url)) {
        removedPages.push(past);
      }
    });

    return { newPages, removedPages, improvedPages, degradedPages };
  }, [currentPages, pastPages]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="no-print">
          View Changes Since Last Audit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Differences</DialogTitle>
          <DialogDescription>
            Comparison between the latest crawl and the previous crawl.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {diff.newPages.length === 0 &&
            diff.removedPages.length === 0 &&
            diff.improvedPages.length === 0 &&
            diff.degradedPages.length === 0 && (
              <p className="text-sm text-zoru-ink-muted text-center py-4">
                No differences found between the last two audits.
              </p>
            )}

          {diff.newPages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                <FilePlus className="h-4 w-4" /> New Pages Crawled ({diff.newPages.length})
              </h4>
              <ul className="text-sm space-y-1">
                {diff.newPages.map(p => (
                  <li key={p.url} className="border p-2 rounded bg-muted/30 truncate">
                    <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">{p.url}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.removedPages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-gray-500">
                <FileMinus className="h-4 w-4" /> Pages No Longer Found ({diff.removedPages.length})
              </h4>
              <ul className="text-sm space-y-1">
                {diff.removedPages.map(p => (
                  <li key={p.url} className="border p-2 rounded bg-muted/30 truncate line-through opacity-70">
                    {p.url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.improvedPages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" /> Improved Pages ({diff.improvedPages.length})
              </h4>
              <ul className="text-sm space-y-1">
                {diff.improvedPages.map(p => (
                  <li key={p.url} className="flex flex-col sm:flex-row sm:items-center justify-between border p-2 rounded bg-muted/30 gap-2">
                    <a href={p.url} target="_blank" rel="noreferrer" className="truncate flex-1 hover:underline">{p.url}</a>
                    <Badge variant="outline" className="shrink-0 bg-green-50 text-green-700 border-green-200">
                      Issues: {p.oldIssues} <ArrowRight className="h-3 w-3 mx-1 inline" /> {p.newIssues}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.degradedPages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" /> Degraded Pages ({diff.degradedPages.length})
              </h4>
              <ul className="text-sm space-y-1">
                {diff.degradedPages.map(p => (
                  <li key={p.url} className="flex flex-col sm:flex-row sm:items-center justify-between border p-2 rounded bg-muted/30 gap-2">
                    <a href={p.url} target="_blank" rel="noreferrer" className="truncate flex-1 hover:underline">{p.url}</a>
                    <Badge variant="outline" className="shrink-0 bg-red-50 text-red-700 border-red-200">
                      Issues: {p.oldIssues} <ArrowRight className="h-3 w-3 mx-1 inline" /> {p.newIssues}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
