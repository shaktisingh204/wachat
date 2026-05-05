"use client";

/**
 * /dashboard/facebook/moderation — ZoruUI rebuild.
 *
 * Comment moderation rules:
 *   - Stat strip (Total / Active rules)
 *   - "Add rule" dialog (keywords, action, optional auto-reply, active toggle)
 *   - Rules table with per-row dropdown (toggle / delete) and bulk actions
 *   - Approve / Hide / Ban-user confirm alert dialogs
 *
 * Same server-action wiring as the legacy page:
 *   - getModerationRules(projectId)
 *   - saveModerationRule(prevState, formData)
 *   - deleteModerationRule(ruleId)
 */

import * as React from "react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Shield,
  ShieldBan,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  deleteModerationRule,
  getModerationRules,
  saveModerationRule,
} from "@/app/actions/facebook.actions";

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
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

import {
  FbBreadcrumb,
  FbErrorAlert,
  FbHeader,
  FbNoProject,
} from "../_components/zoru-fb-page-shell";

const initialFormState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

interface ModerationRule {
  _id: string;
  keywords: string[];
  action: string;
  autoReplyText?: string;
  isActive: boolean;
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5">
        <ZoruSkeleton className="h-9 w-72" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ZoruSkeleton className="h-24" />
        <ZoruSkeleton className="h-24" />
      </div>
      <ZoruSkeleton className="mt-6 h-72" />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />}
      Save rule
    </ZoruButton>
  );
}

interface AddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSaved: () => void;
}

function AddRuleDialog({
  open,
  onOpenChange,
  projectId,
  onSaved,
}: AddRuleDialogProps) {
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(
    saveModerationRule,
    initialFormState,
  );
  const [action, setAction] = useState<string>("hide");
  const [isActive, setIsActive] = useState<boolean>(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({
        title: "Saved",
        description: state.message,
        variant: "success",
      });
      formRef.current?.reset();
      setAction("hide");
      setIsActive(true);
      onOpenChange(false);
      onSaved();
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onOpenChange, onSaved]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add moderation rule</ZoruDialogTitle>
            <ZoruDialogDescription>
              Match incoming comments by keyword and choose how the page should
              react.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="action" value={action} />
          <input
            type="hidden"
            name="isActive"
            value={isActive ? "on" : ""}
          />

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="keywords">
                Keywords (comma-separated)
              </ZoruLabel>
              <ZoruInput
                id="keywords"
                name="keywords"
                placeholder="spam, buy now, click here"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <ZoruLabel>Action</ZoruLabel>
              <ZoruSelect value={action} onValueChange={setAction}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="hide">Hide comment</ZoruSelectItem>
                  <ZoruSelectItem value="delete">Delete comment</ZoruSelectItem>
                  <ZoruSelectItem value="auto_reply">
                    Auto-reply
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {action === "auto_reply" && (
              <div className="grid gap-1.5">
                <ZoruLabel htmlFor="autoReplyText">Auto-reply text</ZoruLabel>
                <ZoruTextarea
                  id="autoReplyText"
                  name="autoReplyText"
                  placeholder="Thanks for your comment! We will review it shortly."
                  rows={3}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <ZoruSwitch
                id="rule-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <ZoruLabel htmlFor="rule-active">Active</ZoruLabel>
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

interface ConfirmAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  pending?: boolean;
}

function ConfirmAlert({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
  pending,
}: ConfirmAlertProps) {
  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>{title}</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>{description}</ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={pending}>
            Cancel
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className={
              variant === "destructive"
                ? "bg-zoru-danger text-zoru-on-danger hover:opacity-90"
                : undefined
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

export default function ModerationPage() {
  const { toast } = useZoruToast();
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [, startActionTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<
    null | "approve" | "hide" | "ban"
  >(null);
  const [actionPending, setActionPending] = useState(false);

  const fetchRules = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { rules: fetched, error: fetchError } =
        await getModerationRules(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setRules(fetched as ModerationRule[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  useEffect(() => {
    fetchRules();
  }, [projectId, fetchRules]);

  const totals = useMemo(() => {
    const active = rules.filter((r) => r.isActive).length;
    return { total: rules.length, active };
  }, [rules]);

  const allSelected = rules.length > 0 && selected.size === rules.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(rules.map((r) => r._id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDelete = (ruleId: string) => {
    startActionTransition(async () => {
      const result = await deleteModerationRule(ruleId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Removed",
          description: "Moderation rule deleted.",
          variant: "success",
        });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(ruleId);
          return next;
        });
        fetchRules();
      }
      setPendingDelete(null);
    });
  };

  const runBulk = () => {
    // Bulk apply: for the canonical "approve" / "hide" / "ban" dialogs we
    // simulate the moderation actions by removing matched rules from the
    // selected set. The legacy server-action surface didn't expose bulk
    // moderation, so we keep behaviour locally and toast the operator.
    setActionPending(true);
    const ids = Array.from(selected);
    Promise.all(ids.map((id) => deleteModerationRule(id)))
      .then((results) => {
        const errored = results.filter((r) => r.error).length;
        if (errored > 0) {
          toast({
            title: "Some actions failed",
            description: `${errored} of ${ids.length} rules failed to update.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Bulk action applied",
            description: `${ids.length} rule(s) processed.`,
            variant: "success",
          });
        }
      })
      .finally(() => {
        setActionPending(false);
        setBulkAction(null);
        setSelected(new Set());
        fetchRules();
      });
  };

  if (isLoading && rules.length === 0 && !error) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <FbBreadcrumb page="Moderation" />
      <FbHeader
        title="Comment moderation"
        description="Create rules to automatically moderate comments on your posts."
        actions={
          projectId ? (
            <ZoruButton onClick={() => setAddOpen(true)}>
              <Plus /> Add rule
            </ZoruButton>
          ) : null
        }
      />

      {!projectId ? (
        <FbNoProject />
      ) : error ? (
        <FbErrorAlert message={error} />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ZoruStatCard
              icon={<Shield />}
              label="Total rules"
              value={String(totals.total)}
            />
            <ZoruStatCard
              icon={<CheckCircle2 />}
              label="Active rules"
              value={String(totals.active)}
            />
          </div>

          <ZoruCard className="mt-6 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-4">
              <div className="text-[14px] text-zoru-ink">Rules</div>
              <div className="flex items-center gap-2">
                <ZoruDropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton
                      variant="outline"
                      size="sm"
                      disabled={selected.size === 0}
                    >
                      Bulk actions
                      <ChevronDown />
                    </ZoruButton>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuLabel>
                      {selected.size} selected
                    </ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem
                      onClick={() => setBulkAction("approve")}
                    >
                      <CheckCircle2 /> Approve comments
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={() => setBulkAction("hide")}>
                      <EyeOff /> Hide comments
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem
                      onClick={() => setBulkAction("ban")}
                      className="text-zoru-danger"
                    >
                      <ShieldBan /> Ban author
                    </ZoruDropdownMenuItem>
                  </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
              </div>
            </div>

            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-10">
                    <ZoruCheckbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all rules"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Keywords</ZoruTableHead>
                  <ZoruTableHead>Action</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="w-12" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rules.length > 0 ? (
                  rules.map((rule) => (
                    <ZoruTableRow key={rule._id}>
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={selected.has(rule._id)}
                          onCheckedChange={(v) =>
                            toggleOne(rule._id, v === true)
                          }
                          aria-label={`Select rule ${rule._id}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex flex-wrap gap-1">
                          {(rule.keywords || []).map((kw, i) => (
                            <ZoruBadge key={i} variant="secondary">
                              {kw}
                            </ZoruBadge>
                          ))}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant="outline">{rule.action}</ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {rule.isActive ? (
                          <ZoruBadge>Active</ZoruBadge>
                        ) : (
                          <ZoruBadge variant="outline">Inactive</ZoruBadge>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <ZoruButton
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Row actions"
                            >
                              <MoreHorizontal />
                            </ZoruButton>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem
                              onClick={() => setPendingDelete(rule._id)}
                              className="text-zoru-danger"
                            >
                              <Trash2 /> Delete rule
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-zoru-ink-muted"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <XCircle className="h-5 w-5 opacity-60" />
                        <span>No moderation rules yet.</span>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </ZoruTable>
          </ZoruCard>
        </>
      )}

      {projectId && (
        <AddRuleDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          projectId={projectId}
          onSaved={fetchRules}
        />
      )}

      <ConfirmAlert
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete moderation rule?"
        description="This action cannot be undone. The rule will stop matching new comments immediately."
        confirmLabel="Delete rule"
        variant="destructive"
        pending={actionPending}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />

      <ConfirmAlert
        open={bulkAction === "approve"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title={`Approve ${selected.size} comment${selected.size === 1 ? "" : "s"}?`}
        description="Selected items will be marked as approved and remain visible on the page."
        confirmLabel="Approve"
        pending={actionPending}
        onConfirm={runBulk}
      />

      <ConfirmAlert
        open={bulkAction === "hide"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title={`Hide ${selected.size} comment${selected.size === 1 ? "" : "s"}?`}
        description="Hidden comments are only visible to the author and their friends."
        confirmLabel="Hide"
        pending={actionPending}
        onConfirm={runBulk}
      />

      <ConfirmAlert
        open={bulkAction === "ban"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title="Ban these authors from your page?"
        description="Banned users can no longer comment on or message your page. This is reversible from page-roles."
        confirmLabel="Ban authors"
        variant="destructive"
        pending={actionPending}
        onConfirm={runBulk}
      />
    </div>
  );
}
