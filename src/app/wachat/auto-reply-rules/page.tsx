'use client';

/**
 * Wachat Auto-Reply Rules — create keyword-based auto-reply rules,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { LuBot, LuLoader, LuTrash2, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  getAutoReplyRules,
  saveAutoReplyRule,
  deleteAutoReplyRule,
} from '@/app/actions/wachat-features.actions';

export default function AutoReplyRulesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [rules, setRules] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
          setRules(res.rules || []);
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
      toast({ title: 'Success', description: formState.message });
      if (projectId) fetchRules(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchRules]);

  const handleDelete = async (ruleId: string) => {
    setDeletingId(ruleId);
    const res = await deleteAutoReplyRule(ruleId);
    setDeletingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setRules((prev) => prev.filter((r) => r._id !== ruleId));
      toast({ title: 'Deleted', description: 'Rule removed.' });
    }
  };

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Auto-Reply Rules' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Auto-Reply Rules
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Set up keyword-based auto-reply rules for incoming WhatsApp messages.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 max-w-md">
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Rules</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{totalRules}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active Rules</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{activeRules}</div>
        </div>
      </div>

      {/* Create form */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Create a rule</h2>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="matchType" value={matchType} />
          <input type="hidden" name="responseType" value={responseType} />
          <input type="hidden" name="isActive" value={isActive ? 'on' : ''} />
          <Input name="name" placeholder="Rule name" required />
          <Input name="keywords" placeholder="Keywords (comma-separated)" required />
          <Select value={matchType} onValueChange={setMatchType}>
            <SelectTrigger><SelectValue placeholder="Match type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="exact">Exact</SelectItem>
              <SelectItem value="starts_with">Starts with</SelectItem>
            </SelectContent>
          </Select>
          <Select value={responseType} onValueChange={setResponseType}>
            <SelectTrigger><SelectValue placeholder="Response type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="template">Template</SelectItem>
            </SelectContent>
          </Select>
          <div className="sm:col-span-2">
            <Textarea name="responseText" placeholder="Response text..." rows={2} />
          </div>
          {responseType === 'template' && (
            <Input name="templateName" placeholder="Template name" className="sm:col-span-2" />
          )}
          <Input name="timeFrom" type="time" placeholder="Active from" />
          <Input name="timeTo" type="time" placeholder="Active to" />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="rule-active" />
            <label htmlFor="rule-active" className="text-[13px] text-foreground">Active</label>
          </div>
          <div className="sm:col-span-2">
            <ClayButton
              type="submit"
              variant="obsidian"
              size="md"
              disabled={isPending || !projectId}
              leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            >
              {isPending ? 'Saving...' : 'Create Rule'}
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {/* Rules table */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Rules</h2>
        {isLoading && rules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary px-4 py-10 text-center">
            <LuBot className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-[13px] font-semibold text-foreground">No rules yet</div>
            <div className="text-[11.5px] text-muted-foreground">Create your first auto-reply rule above.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule._id}>
                  <TableCell className="font-medium text-[13px]">{rule.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(rule.keywords || []).slice(0, 3).map((kw: string) => (
                        <Badge key={kw} variant="secondary" className="text-[11px]">{kw}</Badge>
                      ))}
                      {(rule.keywords || []).length > 3 && (
                        <Badge variant="outline" className="text-[11px]">+{rule.keywords.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{rule.matchType}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-[13px] text-muted-foreground">
                    {rule.responseText || rule.templateName || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? 'default' : 'secondary'} className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(rule._id)}
                      disabled={deletingId === rule._id}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-rose-50 transition-colors ml-auto"
                      aria-label="Delete rule"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}
