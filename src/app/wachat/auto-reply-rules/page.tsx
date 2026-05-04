'use client';

/**
 * /wachat/auto-reply-rules — keyword-based auto-reply rules (ZoruUI).
 *
 * Rule list (with create/edit sheet + delete confirm) — server actions and
 * data are unchanged from the Clay version.
 *
 * TODO: drag-reorder. Stubbed — list renders in insertion order; reorder
 * persistence not implemented in this phase.
 */

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { Bot, Loader, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteAutoReplyRule,
  getAutoReplyRules,
  saveAutoReplyRule,
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
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

type AutoReplyRule = {
  _id: string;
  name: string;
  keywords?: string[];
  matchType: string;
  responseType?: string;
  responseText?: string;
  templateName?: string;
  timeFrom?: string;
  timeTo?: string;
  isActive?: boolean;
};

export default function AutoReplyRulesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutoReplyRule | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const [responseType, setResponseType] = useState('text');
  const [matchType, setMatchType] = useState('contains');
  const [isActive, setIsActive] = useState(true);

  const [formState, formAction, isPending] = useActionState(saveAutoReplyRule, null);

  const fetchRules = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getAutoReplyRules(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setRules((res.rules || []) as AutoReplyRule[]);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchRules(projectId);
  }, [projectId, fetchRules]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Saved', description: formState.message });
      setCreateOpen(false);
      if (projectId) fetchRules(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchRules]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleting(async () => {
      const res = await deleteAutoReplyRule(target._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setRules((prev) => prev.filter((r) => r._id !== target._id));
        toast({ title: 'Deleted', description: 'Rule removed.' });
      }
      setDeleteTarget(null);
    });
  };

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Auto-Reply Rules</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageTitle>Auto-Reply Rules</ZoruPageTitle>
          <ZoruPageDescription>
            Set up keyword-based auto-reply rules for incoming WhatsApp messages.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={!projectId}
          >
            <Plus /> Create rule
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Stats */}
      <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
        <ZoruCard className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Total rules
          </div>
          <div className="mt-2 text-[22px] text-zoru-ink leading-none">
            {totalRules}
          </div>
        </ZoruCard>
        <ZoruCard className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Active rules
          </div>
          <div className="mt-2 text-[22px] text-zoru-ink leading-none">
            {activeRules}
          </div>
        </ZoruCard>
      </div>

      {/* Rules list (drag-reorder TODO) */}
      <ZoruCard className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] text-zoru-ink">Rules</h2>
          {isLoading && (
            <Loader className="h-4 w-4 animate-spin text-zoru-ink-muted" />
          )}
        </div>

        {isLoading && rules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : rules.length === 0 ? (
          <ZoruEmptyState
            icon={<Bot />}
            title="No rules yet"
            description="Create your first auto-reply rule to handle keyword-triggered responses."
            action={
              <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
                <Plus /> Create rule
              </ZoruButton>
            }
          />
        ) : (
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Keywords</ZoruTableHead>
                <ZoruTableHead>Match</ZoruTableHead>
                <ZoruTableHead>Response</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead className="text-right">Action</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rules.map((rule) => (
                <ZoruTableRow key={rule._id}>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {rule.name}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex flex-wrap gap-1">
                      {(rule.keywords || []).slice(0, 3).map((kw) => (
                        <ZoruBadge key={kw} variant="secondary">
                          {kw}
                        </ZoruBadge>
                      ))}
                      {(rule.keywords || []).length > 3 && (
                        <ZoruBadge variant="outline">
                          +{(rule.keywords || []).length - 3}
                        </ZoruBadge>
                      )}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                    {rule.matchType}
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-[200px] truncate text-[13px] text-zoru-ink-muted">
                    {rule.responseText || rule.templateName || '-'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <ZoruButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(rule)}
                      aria-label="Delete rule"
                    >
                      <Trash2 />
                    </ZoruButton>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        )}
      </ZoruCard>

      {/* Create-rule sheet */}
      <ZoruSheet open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruSheetContent side="right" className="sm:max-w-lg">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Create auto-reply rule</ZoruSheetTitle>
            <ZoruSheetDescription>
              Trigger a response when an incoming message matches your keywords.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="projectId" value={projectId || ''} />
            <input type="hidden" name="matchType" value={matchType} />
            <input type="hidden" name="responseType" value={responseType} />
            <input type="hidden" name="isActive" value={isActive ? 'on' : ''} />

            <div className="grid gap-2">
              <ZoruLabel htmlFor="rule-name">Rule name</ZoruLabel>
              <ZoruInput id="rule-name" name="name" placeholder="Welcome new customers" required />
            </div>

            <div className="grid gap-2">
              <ZoruLabel htmlFor="rule-keywords">Keywords</ZoruLabel>
              <ZoruInput
                id="rule-keywords"
                name="keywords"
                placeholder="hi, hello, hey"
                required
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Comma-separated. Matching is case-insensitive.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <ZoruLabel>Match type</ZoruLabel>
                <ZoruSelect value={matchType} onValueChange={setMatchType}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Match type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                    <ZoruSelectItem value="exact">Exact</ZoruSelectItem>
                    <ZoruSelectItem value="starts_with">Starts with</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="grid gap-2">
                <ZoruLabel>Response type</ZoruLabel>
                <ZoruSelect value={responseType} onValueChange={setResponseType}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Response type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="text">Text</ZoruSelectItem>
                    <ZoruSelectItem value="template">Template</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>

            <div className="grid gap-2">
              <ZoruLabel htmlFor="rule-response">Response text</ZoruLabel>
              <ZoruTextarea
                id="rule-response"
                name="responseText"
                placeholder="Hi! Thanks for reaching out..."
                rows={3}
              />
            </div>

            {responseType === 'template' && (
              <div className="grid gap-2">
                <ZoruLabel htmlFor="rule-template">Template name</ZoruLabel>
                <ZoruInput
                  id="rule-template"
                  name="templateName"
                  placeholder="welcome_template"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <ZoruLabel htmlFor="rule-from">Active from</ZoruLabel>
                <ZoruInput id="rule-from" name="timeFrom" type="time" />
              </div>
              <div className="grid gap-2">
                <ZoruLabel htmlFor="rule-to">Active to</ZoruLabel>
                <ZoruInput id="rule-to" name="timeTo" type="time" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ZoruSwitch
                id="rule-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <ZoruLabel htmlFor="rule-active">Active</ZoruLabel>
            </div>

            <ZoruSheetFooter className="pt-2">
              <ZoruButton
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isPending || !projectId}>
                {isPending ? 'Saving…' : 'Create rule'}
              </ZoruButton>
            </ZoruSheetFooter>
          </form>
        </ZoruSheetContent>
      </ZoruSheet>

      {/* Delete-rule confirm */}
      <ZoruAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this rule?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {deleteTarget?.name
                ? `“${deleteTarget.name}” will stop responding to incoming messages.`
                : 'This rule will stop responding to incoming messages.'}{' '}
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="h-6" />
    </div>
  );
}
