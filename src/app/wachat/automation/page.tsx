'use client';

/**
 * Wachat Conversational Automation — Meta's native automation features.
 *
 * Manage welcome messages, ice breakers (prompts), and chat commands
 * directly via the WhatsApp Cloud API conversational_automation endpoint.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  LuBot,
  LuMessageCircle,
  LuPlus,
  LuTrash2,
  LuRefreshCw,
  LuSave,
  LuSparkles,
  LuTerminal,
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getConversationalAutomation,
  handleUpdateConversationalAutomation,
  handleDeleteConversationalAutomation,
} from '@/app/actions/whatsapp.actions';

import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function AutomationPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [commands, setCommands] = useState<Array<{ command_name: string; command_description: string }>>([]);
  const [newCommandName, setNewCommandName] = useState('');
  const [newCommandDesc, setNewCommandDesc] = useState('');

  const selectedPhoneId = activeProject?.phoneNumbers?.[0]?.id;

  const fetchAutomation = useCallback(() => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await getConversationalAutomation(activeProject._id.toString(), selectedPhoneId);
      if (result.error) {
        // API may return error if not yet configured - that's OK
        console.warn('Automation fetch:', result.error);
      } else if (result.automation) {
        const data = Array.isArray(result.automation) ? result.automation[0] : result.automation;
        if (data) {
          setWelcomeEnabled(data.enable_welcome_message ?? false);
          setPrompts(data.prompts || []);
          setCommands(data.commands || []);
        }
      }
    });
  }, [activeProject?._id, selectedPhoneId]);

  useEffect(() => {
    fetchAutomation();
  }, [fetchAutomation]);

  const handleSave = () => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await handleUpdateConversationalAutomation(
        activeProject._id.toString(),
        selectedPhoneId,
        {
          enable_welcome_message: welcomeEnabled,
          prompts: prompts.filter(Boolean),
          commands: commands.filter(c => c.command_name && c.command_description),
        }
      );
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: result.message });
      }
    });
  };

  const addPrompt = () => {
    if (newPrompt.trim() && prompts.length < 4) {
      setPrompts([...prompts, newPrompt.trim()]);
      setNewPrompt('');
    }
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const addCommand = () => {
    if (newCommandName.trim() && newCommandDesc.trim() && commands.length < 30) {
      setCommands([...commands, { command_name: newCommandName.trim(), command_description: newCommandDesc.trim() }]);
      setNewCommandName('');
      setNewCommandDesc('');
    }
  };

  const removeCommand = (index: number) => {
    setCommands(commands.filter((_, i) => i !== index));
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Automation' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Conversational Automation
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Configure Meta&apos;s native automation features: welcome messages, ice breakers, and chat commands.
          </p>
        </div>
        <div className="flex gap-2">
          <ClayButton size="sm" variant="ghost" onClick={fetchAutomation} disabled={isPending}>
            <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </ClayButton>
          <ClayButton size="sm" onClick={handleSave} disabled={isPending}>
            <LuSave className="mr-1.5 h-3.5 w-3.5" />
            Save Changes
          </ClayButton>
        </div>
      </div>

      {/* Welcome Message */}
      <ClayCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <LuMessageCircle className="h-4.5 w-4.5 text-green-500" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Welcome Message</h2>
            <p className="text-[11px] text-muted-foreground">Automatically greet customers when they start a conversation.</p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={welcomeEnabled}
            onChange={(e) => setWelcomeEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-sm text-foreground">Enable welcome message</span>
        </label>
      </ClayCard>

      {/* Ice Breakers / Prompts */}
      <ClayCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <LuSparkles className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Ice Breakers</h2>
            <p className="text-[11px] text-muted-foreground">Suggested prompts shown to customers when they first open the chat (max 4).</p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {prompts.map((prompt, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <span className="flex-1 text-sm text-foreground">{prompt}</span>
              <button onClick={() => removePrompt(i)} className="text-muted-foreground hover:text-red-500">
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {prompts.length < 4 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Add an ice breaker prompt..."
              maxLength={80}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') addPrompt(); }}
            />
            <ClayButton size="sm" variant="ghost" onClick={addPrompt} disabled={!newPrompt.trim()}>
              <LuPlus className="h-3.5 w-3.5" />
            </ClayButton>
          </div>
        )}
      </ClayCard>

      {/* Commands */}
      <ClayCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
            <LuTerminal className="h-4.5 w-4.5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Chat Commands</h2>
            <p className="text-[11px] text-muted-foreground">Register slash commands that customers can use in the chat (max 30).</p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <span className="text-sm font-mono text-accent">/{cmd.command_name}</span>
              <span className="flex-1 text-sm text-muted-foreground">{cmd.command_description}</span>
              <button onClick={() => removeCommand(i)} className="text-muted-foreground hover:text-red-500">
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {commands.length < 30 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommandName}
              onChange={(e) => setNewCommandName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
              placeholder="command_name"
              className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newCommandDesc}
              onChange={(e) => setNewCommandDesc(e.target.value)}
              placeholder="Description of the command..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') addCommand(); }}
            />
            <ClayButton size="sm" variant="ghost" onClick={addCommand} disabled={!newCommandName.trim() || !newCommandDesc.trim()}>
              <LuPlus className="h-3.5 w-3.5" />
            </ClayButton>
          </div>
        )}
      </ClayCard>

      {!selectedPhoneId && (
        <ClayCard className="p-12 text-center">
          <LuBot className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a project with a configured phone number to manage automation.</p>
        </ClayCard>
      )}
    </div>
  );
}
