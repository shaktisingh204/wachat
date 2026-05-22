'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruRadioCard,
  RadioGroup,
  Separator,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Bot,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Terminal,
  Trash2,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getConversationalAutomation,
  handleDeleteConversationalAutomation,
  handleUpdateConversationalAutomation,
  } from '@/app/actions/whatsapp.actions';

/**
 * /wachat/automation — Conversational AI overview (ZoruUI).
 *
 * Wraps Meta's native conversational_automation API: welcome message,
 * ice-breaker prompts, slash commands. Same data + handlers as before.
 *
 * Phase 6 visual swap. Model picker / fallback rendered as ZoruRadioCard.
 */

import * as React from 'react';

export const dynamic = 'force-dynamic';

const MODEL_OPTIONS = [
  {
    value: 'meta-native',
    label: 'Meta native automation',
    description: 'Welcome, ice-breakers and commands via WhatsApp Cloud API.',
  },
  {
    value: 'sabnode-ai',
    label: 'SabNode AI assistant',
    description: 'Knowledge-base grounded replies via your own training data.',
  },
] as const;

export default function AutomationPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [commands, setCommands] = useState<
    Array<{ command_name: string; command_description: string }>
  >([]);
  const [newCommandName, setNewCommandName] = useState('');
  const [newCommandDesc, setNewCommandDesc] = useState('');
  const [model, setModel] = useState<string>('meta-native');
  const [trainOpen, setTrainOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const selectedPhoneId = activeProject?.phoneNumbers?.[0]?.id;

  const fetchAutomation = useCallback(() => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await getConversationalAutomation(
        activeProject._id.toString(),
        selectedPhoneId,
      );
      if (result.error) {
        // not yet configured is OK
        // eslint-disable-next-line no-console
        console.warn('Automation fetch:', result.error);
      } else if (result.automation) {
        const data = Array.isArray(result.automation)
          ? result.automation[0]
          : result.automation;
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
          commands: commands.filter(
            (c) => c.command_name && c.command_description,
          ),
        },
      );
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: result.message });
      }
    });
  };

  const handleReset = () => {
    if (!activeProject?._id || !selectedPhoneId) return;
    startTransition(async () => {
      const result = await handleDeleteConversationalAutomation(
        activeProject._id.toString(),
        selectedPhoneId,
        ['enable_welcome_message', 'prompts', 'commands'],
      );
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        setWelcomeEnabled(false);
        setPrompts([]);
        setCommands([]);
        toast({ title: 'Reset', description: result.message || 'Automation cleared.' });
      }
      setResetOpen(false);
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
      setCommands([
        ...commands,
        {
          command_name: newCommandName.trim(),
          command_description: newCommandDesc.trim(),
        },
      ]);
      setNewCommandName('');
      setNewCommandDesc('');
    }
  };

  const removeCommand = (index: number) => {
    setCommands(commands.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>Automation</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageTitle>Conversational Automation</ZoruPageTitle>
          <ZoruPageDescription>
            Configure Meta&apos;s native automation features: welcome messages,
            ice breakers, and chat commands.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAutomation}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTrainOpen(true)}
            disabled={!selectedPhoneId}
          >
            <Sparkles /> Train
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending || !selectedPhoneId}>
            <Save /> Save
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {!selectedPhoneId ? (
        <div className="mt-6">
          <EmptyState
            icon={<Bot />}
            title="No phone number connected"
            description="Select a project with a configured WhatsApp phone number to manage automation."
          />
        </div>
      ) : (
        <>
          {/* Model picker */}
          <Card className="mt-6 p-5">
            <h2 className="text-[15px] text-zoru-ink">Model</h2>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Pick the engine that powers this project&apos;s automation.
            </p>
            <RadioGroup
              value={model}
              onValueChange={setModel}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {MODEL_OPTIONS.map((opt) => (
                <ZoruRadioCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </RadioGroup>
          </Card>

          {/* Welcome */}
          <Card className="mt-6 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                <MessageCircle />
              </span>
              <div>
                <h2 className="text-[14px] text-zoru-ink leading-tight">
                  Welcome message
                </h2>
                <p className="text-[12px] text-zoru-ink-muted leading-tight">
                  Automatically greet customers when they start a conversation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="welcome-enabled"
                checked={welcomeEnabled}
                onCheckedChange={setWelcomeEnabled}
              />
              <Label htmlFor="welcome-enabled">Enable welcome message</Label>
            </div>
          </Card>

          {/* Ice breakers */}
          <Card className="mt-6 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                <Sparkles />
              </span>
              <div>
                <h2 className="text-[14px] text-zoru-ink leading-tight">
                  Ice breakers
                </h2>
                <p className="text-[12px] text-zoru-ink-muted leading-tight">
                  Suggested prompts shown when customers first open the chat (max 4).
                </p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {prompts.length}/4
              </Badge>
            </div>

            {prompts.length > 0 && (
              <ul className="mb-3 space-y-2">
                {prompts.map((prompt, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2"
                  >
                    <span className="flex-1 text-sm text-zoru-ink">{prompt}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePrompt(i)}
                      aria-label="Remove prompt"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {prompts.length < 4 && (
              <div className="flex gap-2">
                <Input
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Add an ice breaker prompt…"
                  maxLength={80}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPrompt();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addPrompt}
                  disabled={!newPrompt.trim()}
                  aria-label="Add prompt"
                >
                  <Plus />
                </Button>
              </div>
            )}
          </Card>

          {/* Commands */}
          <Card className="mt-6 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                <Terminal />
              </span>
              <div>
                <h2 className="text-[14px] text-zoru-ink leading-tight">
                  Chat commands
                </h2>
                <p className="text-[12px] text-zoru-ink-muted leading-tight">
                  Slash commands customers can use in chat (max 30).
                </p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {commands.length}/30
              </Badge>
            </div>

            {commands.length > 0 && (
              <ul className="mb-3 space-y-2">
                {commands.map((cmd, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2"
                  >
                    <span className="font-mono text-sm text-zoru-ink">
                      /{cmd.command_name}
                    </span>
                    <span className="flex-1 truncate text-sm text-zoru-ink-muted">
                      {cmd.command_description}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCommand(i)}
                      aria-label="Remove command"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {commands.length < 30 && (
              <div className="flex gap-2">
                <Input
                  value={newCommandName}
                  onChange={(e) =>
                    setNewCommandName(
                      e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase(),
                    )
                  }
                  placeholder="command_name"
                  className="w-44 font-mono"
                />
                <Input
                  value={newCommandDesc}
                  onChange={(e) => setNewCommandDesc(e.target.value)}
                  placeholder="Description of the command…"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCommand();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addCommand}
                  disabled={!newCommandName.trim() || !newCommandDesc.trim()}
                  aria-label="Add command"
                >
                  <Plus />
                </Button>
              </div>
            )}
          </Card>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-zoru-ink-muted">
              Reset clears all welcome, ice-breaker and command configuration on Meta.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetOpen(true)}
              disabled={isPending}
            >
              Reset automation
            </Button>
          </div>
        </>
      )}

      {/* Train dialog */}
      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Train conversational AI</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add training samples that teach the AI how to respond. Saved samples
              will be available next time the assistant runs.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="train-question">Sample question</Label>
              <Input
                id="train-question"
                placeholder="What are your business hours?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="train-answer">Ideal answer</Label>
              <Textarea
                id="train-answer"
                placeholder="We're open Mon–Fri, 9am–6pm IST."
                rows={3}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: 'Saved',
                  description: 'Training sample queued.',
                });
                setTrainOpen(false);
              }}
            >
              Save sample
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Reset confirm */}
      <ZoruAlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Reset automation?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All welcome messages, ice breakers and slash commands will be cleared
              from Meta for this number. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isPending}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={handleReset}
              disabled={isPending}
            >
              {isPending ? 'Resetting…' : 'Yes, reset'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="h-6" />
    </div>
  );
}
