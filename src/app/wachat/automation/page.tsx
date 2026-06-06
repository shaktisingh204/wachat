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
  RadioCard,
  RadioCardGroup,
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
import {
  createAiTrainingSample,
  deleteAiTrainingSample,
  getAiModelConfig,
  getAiTrainingSamples,
  saveAiModelConfig,
} from '@/app/actions/wachat-ai-training.actions';

import { Spinner } from '@/components/sabcrm/20ui';

interface TrainingSampleView {
  _id: string;
  question: string;
  answer: string;
}

/**
 * /wachat/automation — Conversational AI overview (20ui).
 *
 * Wraps Meta's native conversational_automation API: welcome message,
 * ice-breaker prompts, slash commands. Same data + handlers as before.
 *
 * 20ui visual swap. Model picker rendered as a 20ui RadioGroup.
 */

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
  const [modelSaving, setModelSaving] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // AI training samples (backed by the wachat-ai-training Rust crate).
  const [samples, setSamples] = useState<TrainingSampleView[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [sampleQuestion, setSampleQuestion] = useState('');
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [sampleSaving, setSampleSaving] = useState(false);
  const [deletingSampleId, setDeletingSampleId] = useState<string | null>(null);

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

  // Load the persisted model choice for this project + phone number.
  const projectId = activeProject?._id ? activeProject._id.toString() : null;

  useEffect(() => {
    if (!projectId || !selectedPhoneId) return;
    let cancelled = false;
    (async () => {
      const result = await getAiModelConfig(projectId, selectedPhoneId);
      if (cancelled) return;
      if ('model' in result) {
        setModel(result.model);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedPhoneId]);

  const loadSamples = useCallback(async () => {
    if (!projectId || !selectedPhoneId) return;
    setSamplesLoading(true);
    setSamplesError(null);
    const result = await getAiTrainingSamples(projectId, selectedPhoneId);
    if ('error' in result) {
      setSamplesError(result.error);
      setSamples([]);
    } else {
      setSamples(
        result.samples.map((s) => ({
          _id: s._id,
          question: s.question,
          answer: s.answer,
        })),
      );
    }
    setSamplesLoading(false);
  }, [projectId, selectedPhoneId]);

  // Persist the model choice whenever the user picks a different engine.
  const handleModelChange = useCallback(
    (next: string) => {
      const previous = model;
      setModel(next);
      if (!projectId || !selectedPhoneId) return;
      setModelSaving(true);
      startTransition(async () => {
        const result = await saveAiModelConfig(projectId, selectedPhoneId, next);
        setModelSaving(false);
        if (!result.success) {
          setModel(previous);
          toast({
            title: 'Error',
            description: result.error || 'Could not save model choice.',
            tone: 'danger',
          });
        } else {
          toast({ title: 'Saved', description: 'Automation model updated.', tone: 'success' });
        }
      });
    },
    [model, projectId, selectedPhoneId, toast],
  );

  const openTrainDialog = useCallback(() => {
    setSampleQuestion('');
    setSampleAnswer('');
    setTrainOpen(true);
    void loadSamples();
  }, [loadSamples]);

  const handleSaveSample = useCallback(() => {
    if (!projectId || !selectedPhoneId) return;
    if (!sampleQuestion.trim() || !sampleAnswer.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Both a sample question and an ideal answer are required.',
        tone: 'danger',
      });
      return;
    }
    setSampleSaving(true);
    startTransition(async () => {
      const result = await createAiTrainingSample(
        projectId,
        selectedPhoneId,
        sampleQuestion,
        sampleAnswer,
      );
      setSampleSaving(false);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, tone: 'danger' });
        return;
      }
      setSamples((prev) => [
        ...prev,
        {
          _id: result.sample._id,
          question: result.sample.question,
          answer: result.sample.answer,
        },
      ]);
      setSampleQuestion('');
      setSampleAnswer('');
      toast({ title: 'Saved', description: 'Training sample saved.', tone: 'success' });
    });
  }, [projectId, selectedPhoneId, sampleQuestion, sampleAnswer, toast]);

  const handleDeleteSample = useCallback(
    (sampleId: string) => {
      if (!projectId || !selectedPhoneId) return;
      setDeletingSampleId(sampleId);
      startTransition(async () => {
        const result = await deleteAiTrainingSample(projectId, selectedPhoneId, sampleId);
        setDeletingSampleId(null);
        if (!result.success) {
          toast({
            title: 'Error',
            description: result.error || 'Could not delete sample.',
            tone: 'danger',
          });
          return;
        }
        setSamples((prev) => prev.filter((s) => s._id !== sampleId));
        toast({ title: 'Deleted', description: 'Training sample removed.', tone: 'success' });
      });
    },
    [projectId, selectedPhoneId, toast],
  );

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
            onClick={openTrainDialog}
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
            <RadioCardGroup
              value={model}
              onChange={handleModelChange}
              label="Automation model"
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {MODEL_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </RadioCardGroup>
            {modelSaving && (
              <p className="mt-3 flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
                <Spinner size="sm" aria-hidden="true" />
                Saving model choice…
              </p>
            )}
          </Card>

          {/* Welcome */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] [&_svg]:size-4"
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
                className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] [&_svg]:size-4"
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
                    className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                  >
                    <span className="flex-1 text-sm text-[var(--st-text)]">
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
                className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] [&_svg]:size-4"
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
                    className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                  >
                    <span className="font-mono text-sm text-[var(--st-text)]">
                      /{cmd.command_name}
                    </span>
                    <span className="flex-1 truncate text-sm text-[var(--st-text-secondary)]">
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
            <p className="text-[12px] text-[var(--st-text-secondary)]">
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
        description="Add training samples that teach the AI how to respond. Saved samples are stored against this number and used the next time the assistant runs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={handleSaveSample}
              disabled={
                sampleSaving || !sampleQuestion.trim() || !sampleAnswer.trim()
              }
            >
              {sampleSaving ? 'Saving…' : 'Save sample'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Field label="Sample question">
              <Input
                id="train-question"
                value={sampleQuestion}
                onChange={(e) => setSampleQuestion(e.target.value)}
                placeholder="What are your business hours?"
              />
            </Field>
            <Field label="Ideal answer">
              <Textarea
                id="train-answer"
                value={sampleAnswer}
                onChange={(e) => setSampleAnswer(e.target.value)}
                placeholder="We're open Mon–Fri, 9am–6pm IST."
                rows={3}
              />
            </Field>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-[var(--st-text)]">
              Saved samples
            </p>
            <Badge kind="outline">{samples.length}</Badge>
          </div>

          {samplesLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[var(--st-text-secondary)]">
              <Spinner size="sm" label="Loading training samples" />
              Loading samples…
            </div>
          ) : samplesError ? (
            <div className="flex flex-col items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border-danger,var(--st-border))] bg-[var(--st-bg)] px-3 py-3">
              <p className="text-[13px] text-[var(--st-text-danger,var(--st-text))]">
                {samplesError}
              </p>
              <Button
                variant="outline"
                size="sm"
                iconLeft={RefreshCw}
                onClick={() => void loadSamples()}
              >
                Retry
              </Button>
            </div>
          ) : samples.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No training samples yet"
              description="Add a question/answer pair above to start teaching the assistant."
            />
          ) : (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {samples.map((sample) => (
                <li
                  key={sample._id}
                  className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {sample.question}
                    </span>
                    <span className="text-[13px] text-[var(--st-text-secondary)]">
                      {sample.answer}
                    </span>
                  </div>
                  <IconButton
                    label="Delete sample"
                    icon={Trash2}
                    variant="ghost"
                    size="sm"
                    disabled={deletingSampleId === sample._id}
                    onClick={() => handleDeleteSample(sample._id)}
                  />
                </li>
              ))}
            </ul>
          )}
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
