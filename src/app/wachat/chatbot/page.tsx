'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuBot, LuPlus, LuTrash2, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput, ClaySelect, ClayBadge } from '@/components/clay';
import { getChatbotResponses, saveChatbotResponse, deleteChatbotResponse } from '@/app/actions/wachat-features.actions';

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'regex', label: 'Regex' },
];

export default function ChatbotPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [responses, setResponses] = useState<any[]>([]);
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatbotResponses(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setResponses(res.responses ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    if (isActive) fd.set('isActive', 'on');
    const res = await saveChatbotResponse(null, fd);
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
    toast({ title: res.message });
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteChatbotResponse(id);
      if (!res.success) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Response deleted.' });
      load();
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Chatbot Responses' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Chatbot Responses</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Define keyword-triggered automatic replies for incoming messages.</p>
      </div>

      {/* Create form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">New Response</h2>
        <form action={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
              Trigger Keyword <ClayInput name="trigger" placeholder="hello" required className="w-full" />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
              Match Type <ClaySelect name="matchType" options={MATCH_TYPES} className="w-40" />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
              Active
              <button type="button" onClick={() => setIsActive(!isActive)}
                className={`relative mt-0.5 h-6 w-11 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-border'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isActive ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
            Response Text
            <textarea name="response" required rows={3} placeholder="Type the automatic response..."
              className="clay-input min-h-[72px] resize-y py-2.5" />
          </label>
          <ClayButton type="submit" variant="obsidian" size="sm" leading={<LuPlus className="h-3.5 w-3.5" />}>
            Create
          </ClayButton>
        </form>
      </ClayCard>

      {/* Responses table */}
      <ClayCard padded={false} className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Responses</h2>
          {isPending && <LuLoader className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {!isPending && responses.length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">No chatbot responses configured.</p>
        )}
        {responses.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_2fr_100px_80px_48px] gap-3 pb-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Trigger</span><span>Response</span><span>Match Type</span><span>Status</span><span />
            </div>
            {responses.map((r) => (
              <div key={r._id} className="grid grid-cols-[1fr_2fr_100px_80px_48px] items-center gap-3 rounded-lg px-1 py-2 text-[13px] text-foreground hover:bg-secondary">
                <span className="font-medium">{r.trigger}</span>
                <span className="truncate text-muted-foreground">{r.response}</span>
                <span className="text-[12px] text-muted-foreground">{r.matchType}</span>
                <ClayBadge tone={r.isActive ? 'green' : 'neutral'} dot>{r.isActive ? 'Active' : 'Inactive'}</ClayBadge>
                <ClayButton variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(r._id)}>
                  <LuTrash2 className="h-3.5 w-3.5" />
                </ClayButton>
              </div>
            ))}
          </div>
        )}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
