'use client';

/**
 * Wachat Contact Blacklist — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { ShieldBan, Plus, Trash2, Upload, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  bulkAddToBlacklist,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
} from '@/components/zoruui';

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBlacklist(projectId);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setNumbers(res.numbers ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    const trimmed = phone.trim();
    if (!trimmed || !projectId) return;
    startMutateTransition(async () => {
      const res = await addToBlacklist(projectId, trimmed);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setPhone('');
      toast({ title: 'Added', description: `${trimmed} blacklisted.` });
      fetchData();
    });
  };

  const handleBulkAdd = () => {
    if (!projectId) return;
    const phones = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    startMutateTransition(async () => {
      const res = await bulkAddToBlacklist(projectId, phones);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setBulkText('');
      setBulkOpen(false);
      toast({
        title: 'Added',
        description: `${res.count} numbers blacklisted.`,
      });
      fetchData();
    });
  };

  const handleRemove = (id: string, phoneNum: string) => {
    startMutateTransition(async () => {
      const res = await removeFromBlacklist(id);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Removed',
        description: `${phoneNum} removed from blacklist.`,
      });
      fetchData();
    });
  };

  const isLoadingInitial = isLoading && numbers.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/contacts">
              Contacts
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Blacklist</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Contact Blacklist
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Block phone numbers from sending messages to your project.
          </p>
        </div>
        <ZoruBadge variant="secondary">{numbers.length} blocked</ZoruBadge>
      </div>

      {/* Add form */}
      <ZoruCard className="p-5">
        <h2 className="mb-3 text-[15px] text-zoru-ink">Add a number</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <ZoruLabel htmlFor="bl-phone">Phone number</ZoruLabel>
            <ZoruInput
              id="bl-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex items-center gap-2">
            <ZoruButton
              size="sm"
              onClick={handleAdd}
              disabled={!phone.trim() || isMutating}
            >
              <Plus /> Add
            </ZoruButton>

            <ZoruDialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <ZoruDialogTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Upload /> Bulk
                </ZoruButton>
              </ZoruDialogTrigger>
              <ZoruDialogContent>
                <ZoruDialogHeader>
                  <ZoruDialogTitle>Bulk add to blacklist</ZoruDialogTitle>
                  <ZoruDialogDescription>
                    Paste one phone number per line. All numbers will be
                    blocked from contacting this project.
                  </ZoruDialogDescription>
                </ZoruDialogHeader>
                <ZoruTextarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="+1234567890&#10;+19876543210&#10;…"
                  className="min-h-[160px]"
                />
                <ZoruDialogFooter>
                  <ZoruButton
                    variant="outline"
                    onClick={() => setBulkOpen(false)}
                  >
                    Cancel
                  </ZoruButton>
                  <ZoruButton
                    onClick={handleBulkAdd}
                    disabled={!bulkText.trim() || isMutating}
                  >
                    {isMutating ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    Add all
                  </ZoruButton>
                </ZoruDialogFooter>
              </ZoruDialogContent>
            </ZoruDialog>
          </div>
        </div>
      </ZoruCard>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : numbers.length > 0 ? (
        <ZoruCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Phone Number</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {numbers.map((item, i) => (
                <tr key={item._id}>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink-muted tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px] text-zoru-ink">
                    {item.phone}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          className="text-zoru-danger hover:bg-zoru-danger/10"
                          disabled={isMutating}
                        >
                          <Trash2 /> Remove
                        </ZoruButton>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>
                            Remove from blacklist?
                          </ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            {item.phone} will be allowed to message your
                            project again.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>
                            Cancel
                          </ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction
                            destructive
                            onClick={() => handleRemove(item._id, item.phone)}
                          >
                            Remove
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ZoruCard>
      ) : (
        <ZoruEmptyState
          icon={<ShieldBan />}
          title="No numbers blacklisted"
          description="Add phone numbers above to block them from contacting this project."
        />
      )}
      <div className="h-6" />
    </div>
  );
}
