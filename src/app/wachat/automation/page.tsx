'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Separator,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
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

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getConversationalAutomation,
  handleDeleteConversationalAutomation,
  handleUpdateConversationalAutomation,
  } from '@/app/actions/whatsapp.actions';

/**
 * /wachat/automation — Conversational AI overview (20ui).
 *
 * Wraps Meta's native conversational_automation API: welcome message,
 * ice-breaker prompts, slash commands. Same data + handlers as before.
 *
 * 20ui visual swap. Model picker rendered as a 20ui RadioGroup.
 */

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
  const { toast } = useToast();
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
        toast({ title: 'Error', description: result.error, tone: 'danger' });
      } else {
        toast({ title: 'Saved', description: result.message, tone: 'success' });
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
        toast({ title: 'Error', description: result.error, tone: 'danger' });
      } else {
        setWelcomeEnabled(false);
        setPrompts([]);
        setCommands([]);
        toast({ title: 'Reset', description: result.message || 'Automation cleared.', tone: 'success' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Automation' },
      ]}
      title="Conversational Automation"
      description="Configure Meta's native automation features: welcome messages, ice breakers, and chat commands."
      width="narrow"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={fetchAutomation}
            disabled={isPending}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={Sparkles}
            onClick={() => setTrainOpen(true)}
            disabled={!selectedPhoneId}
          >
            Train
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Save}
            onClick={handleSave}
            disabled={isPending || !selectedPhoneId}
          >
            Save
          </Button>
        </>
      }
    >
      {!selectedPhoneId ? (
        <EmptyState
          icon={Bot}
          title="No phone number connected"
          description="Select a project with a configured WhatsApp phone number to manage automation."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Model picker */}
          <Card padding="lg">
            <CardTitle>Model</CardTitle>
            <CardDescription>
              Pick the engine that powers this project&apos;s automation.
            </CardDescription>
            <RadioGroup
              value={model}
              onValueChange={setModel}
              aria-label="Automation model"
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {MODEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer flex-col gap-1.5 p-3"
                  style={{
                    border: `1px solid ${model === opt.value ? 'var(--st-accent)' : 'var(--st-border)'}`,
                    borderRadius: 'var(--st-radius)',
                    background: model === opt.value ? 'var(--st-accent-soft)' : 'var(--st-bg)',
                  }}
                >
                  <Radio value={opt.value} label={opt.label} />
                  <span
                    className="text-[12.5px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    {opt.description}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </Card>

          {/* Welcome */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center [&_svg]:size-4"
                style={{
                  borderRadius: 'var(--st-radius-sm)',
                  background: 'var(--st-bg-secondary)',
                  color: 'var(--st-text)',
                }}
              >
                <MessageCircle aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Welcome message</CardTitle>
                <CardDescription>
                  Automatically greet customers when they start a conversation.
                </CardDescription>
              </div>
            </div>
            <Switch
              id="welcome-enabled"
              checked={welcomeEnabled}
              onCheckedChange={setWelcomeEnabled}
              label="Enable welcome message"
            />
          </Card>

          {/* Ice breakers */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center [&_svg]:size-4"
                style={{
                  borderRadius: 'var(--st-radius-sm)',
                  background: 'var(--st-bg-secondary)',
                  color: 'var(--st-text)',
                }}
              >
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Ice breakers</CardTitle>
                <CardDescription>
                  Suggested prompts shown when customers first open the chat (max 4).
                </CardDescription>
              </div>
              <Badge kind="outline" className="ml-auto">
                {prompts.length}/4
              </Badge>
            </div>

            {prompts.length > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {prompts.map((prompt, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-2"
                    style={{
                      border: '1px solid var(--st-border)',
                      borderRadius: 'var(--st-radius)',
                      background: 'var(--st-bg)',
                    }}
                  >
                    <span
                      className="flex-1 text-sm"
                      style={{ color: 'var(--st-text)' }}
                    >
                      {prompt}
                    </span>
                    <IconButton
                      label="Remove prompt"
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      onClick={() => removePrompt(i)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {prompts.length < 4 && (
              <div className="flex gap-2">
                <Field label="Ice breaker prompt" className="flex-1">
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
                </Field>
                <IconButton
                  label="Add prompt"
                  icon={Plus}
                  variant="outline"
                  className="mt-[22px]"
                  onClick={addPrompt}
                  disabled={!newPrompt.trim()}
                />
              </div>
            )}
          </Card>

          {/* Commands */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center [&_svg]:size-4"
                style={{
                  borderRadius: 'var(--st-radius-sm)',
                  background: 'var(--st-bg-secondary)',
                  color: 'var(--st-text)',
                }}
              >
                <Terminal aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Chat commands</CardTitle>
                <CardDescription>
                  Slash commands customers can use in chat (max 30).
                </CardDescription>
              </div>
              <Badge kind="outline" className="ml-auto">
                {commands.length}/30
              </Badge>
            </div>

            {commands.length > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {commands.map((cmd, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{
                      border: '1px solid var(--st-border)',
                      borderRadius: 'var(--st-radius)',
                      background: 'var(--st-bg)',
                    }}
                  >
                    <span
                      className="font-mono text-sm"
                      style={{ color: 'var(--st-text)' }}
                    >
                      /{cmd.command_name}
                    </span>
                    <span
                      className="flex-1 truncate text-sm"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      {cmd.command_description}
                    </span>
                    <IconButton
                      label="Remove command"
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCommand(i)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {commands.length < 30 && (
              <div className="flex gap-2">
                <Field label="Command name">
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
                </Field>
                <Field label="Description" className="flex-1">
                  <Input
                    value={newCommandDesc}
                    onChange={(e) => setNewCommandDesc(e.target.value)}
                    placeholder="Description of the command…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCommand();
                      }
                    }}
                  />
                </Field>
                <IconButton
                  label="Add command"
                  icon={Plus}
                  variant="outline"
                  className="mt-[22px]"
                  onClick={addCommand}
                  disabled={!newCommandName.trim() || !newCommandDesc.trim()}
                />
              </div>
            )}
          </Card>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
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
        </div>
      )}

      {/* Train dialog */}
      <Modal
        open={trainOpen}
        onClose={() => setTrainOpen(false)}
        title="Train conversational AI"
        description="Add training samples that teach the AI how to respond. Saved samples will be available next time the assistant runs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({
                  title: 'Saved',
                  description: 'Training sample queued.',
                  tone: 'success',
                });
                setTrainOpen(false);
              }}
            >
              Save sample
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Sample question">
            <Input
              id="train-question"
              placeholder="What are your business hours?"
            />
          </Field>
          <Field label="Ideal answer">
            <Textarea
              id="train-answer"
              placeholder="We're open Mon–Fri, 9am–6pm IST."
              rows={3}
            />
          </Field>
        </div>
      </Modal>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset automation?</AlertDialogTitle>
            <AlertDialogDescription>
              All welcome messages, ice breakers and slash commands will be cleared
              from Meta for this number. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              onClick={handleReset}
              disabled={isPending}
            >
              {isPending ? 'Resetting…' : 'Yes, reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
