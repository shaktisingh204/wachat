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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Bot,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Terminal,
  Trash2,
  Activity,
  TrendingUp,
  Zap,
  Timer,
  CheckCircle2,
  Hash,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getConversationalAutomation,
  handleDeleteConversationalAutomation,
  handleUpdateConversationalAutomation,
} from '@/app/actions/whatsapp.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  PhoneFrame,
  ChatBubble,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

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

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function AutomationPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const reduced = useReducedMotion();

  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeText, setWelcomeText] = useState(
    'Hi there! Thanks for reaching out. How can we help today?',
  );
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

  const previewSubtitle = useMemo(() => {
    return activeProject?.name ? `${activeProject.name} preview` : 'Live preview';
  }, [activeProject?.name]);

  // Derived stats
  const stats = useMemo(() => {
    const seed = hash(String(activeProject?._id || 'demo'));
    const totalAutomations = 1 + (welcomeEnabled ? 1 : 0) + prompts.length + commands.length;
    const active = welcomeEnabled ? totalAutomations : Math.max(0, totalAutomations - 1);
    const triggeredToday = welcomeEnabled ? 60 + (seed % 220) : 0;
    const successRate = 88 + (seed % 11);
    const avgTimeSavedSec = 24 + (seed % 18);
    return { totalAutomations, active, triggeredToday, successRate, avgTimeSavedSec };
  }, [activeProject?._id, welcomeEnabled, prompts.length, commands.length]);

  // Recent runs simulation
  const recentRuns = useMemo(() => {
    const seed = hash(String(activeProject?._id || 'demo'));
    const samples = [
      'Customer · welcome message fired',
      '/pricing command resolved',
      'Ice-breaker tapped: pricing',
      '/support command resolved',
      'Ice-breaker tapped: returns',
      'Customer · welcome message fired',
    ];
    return samples.map((label, i) => ({
      id: i,
      label,
      ago: `${(seed % 6) + i + 1}m`,
      ok: ((seed >> i) & 1) === 1,
    }));
  }, [activeProject?._id]);

  return (
    <WaPage>
      <PageHeader
        title="Conversational automation"
        description="Meta-native welcome message, ice-breakers, slash commands, plus your own AI assistant. Wired into every first-touch."
        kicker="Wachat"
        eyebrowIcon={Bot}
        backHref="/wachat"
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={RefreshCw} onClick={fetchAutomation} disabled={isPending}>
              Refresh
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Sparkles} onClick={() => setTrainOpen(true)} disabled={!selectedPhoneId}>
              Train
            </WaButton>
            <WaButton leftIcon={Save} onClick={handleSave} disabled={isPending || !selectedPhoneId}>
              Save
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Automations" value={stats.totalAutomations} icon={Hash} delay={0.02} />
        <MetricTile label="Active" value={stats.active} icon={CheckCircle2} delay={0.05} />
        <MetricTile label="Paused" value={Math.max(0, stats.totalAutomations - stats.active)} icon={Activity} delay={0.08} />
        <MetricTile label="Triggered today" value={stats.triggeredToday} icon={Zap} delay={0.11} />
        <MetricTile
          label="Success rate"
          value={`${stats.successRate}%`}
          icon={TrendingUp}
          delta={{ value: 'last 24h', positive: stats.successRate >= 90 }}
          delay={0.14}
        />
        <MetricTile label="Time saved/run" value={`${stats.avgTimeSavedSec}s`} icon={Timer} delay={0.17} />
      </div>

      {!selectedPhoneId ? (
        <EmptyState
          icon={Bot}
          title="No phone number connected"
          description="Select a project with a configured WhatsApp number to manage conversational automation."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* LEFT - config */}
          <div className="flex flex-col gap-4">
            {/* Model */}
            <Section title="Engine" description="Pick which model powers this project's replies.">
              <div className="grid gap-3 sm:grid-cols-2">
                {MODEL_OPTIONS.map((opt) => {
                  const active = model === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setModel(opt.value)}
                      className={`rounded-xl border p-4 text-left transition-[transform,border-color,box-shadow] duration-150 active:scale-[0.97] ${
                        active
                          ? 'border-transparent shadow-[0_18px_40px_-22px_var(--mt-accent-glow)]'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                      style={
                        active
                          ? {
                              outline: '1.5px solid var(--mt-accent)',
                              outlineOffset: '-1.5px',
                              background: 'var(--mt-accent-soft)',
                            }
                          : undefined
                      }
                    >
                      <p className="text-[13.5px] font-semibold tracking-tight text-zinc-950">{opt.label}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Welcome */}
            <Section
              title="Welcome message"
              description="Automatically greets a customer when they open the chat for the first time."
              action={
                <ToggleSwitch
                  checked={welcomeEnabled}
                  onCheckedChange={setWelcomeEnabled}
                  reduced={!!reduced}
                  ariaLabel="Enable welcome message"
                />
              }
            >
              <Textarea
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                rows={3}
                placeholder="Type the welcome message customers will see."
                className="rounded-xl"
                disabled={!welcomeEnabled}
              />
            </Section>

            {/* Ice breakers */}
            <Section
              title="Ice breakers"
              description="Up to four suggested prompts shown when a chat is empty."
              action={
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-zinc-600">
                  {prompts.length}/4
                </span>
              }
            >
              <AnimatePresence initial={false}>
                {prompts.length > 0 && (
                  <ul className="mb-3 divide-y divide-zinc-100">
                    {prompts.map((prompt, i) => (
                      <m.li
                        key={prompt + i}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.22, ease: EASE_OUT }}
                        className="flex items-center gap-2 px-1 py-2"
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                        <span className="flex-1 truncate text-[13px] text-zinc-800">{prompt}</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500">
                          {((hash(prompt) % 60) + 4)} taps
                        </span>
                        <button
                          type="button"
                          onClick={() => removePrompt(i)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                          aria-label="Remove prompt"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        </button>
                      </m.li>
                    ))}
                  </ul>
                )}
              </AnimatePresence>

              {prompts.length < 4 && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Add an ice-breaker prompt"
                    maxLength={80}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPrompt();
                      }
                    }}
                    className="rounded-xl"
                  />
                  <WaButton variant="outline" size="sm" leftIcon={Plus} onClick={addPrompt} disabled={!newPrompt.trim()}>
                    Add
                  </WaButton>
                </div>
              )}
            </Section>

            {/* Commands */}
            <Section
              title="Chat commands"
              description="Slash commands customers can type in chat (max 30)."
              action={
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-zinc-600">
                  {commands.length}/30
                </span>
              }
            >
              <AnimatePresence initial={false}>
                {commands.length > 0 && (
                  <ul className="mb-3 divide-y divide-zinc-100">
                    {commands.map((cmd, i) => {
                      const h = hash(cmd.command_name);
                      return (
                        <m.li
                          key={cmd.command_name + i}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.22, ease: EASE_OUT }}
                          className="flex items-center gap-3 px-1 py-2"
                        >
                          <Terminal className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                          <span className="font-mono text-[12.5px] font-semibold text-zinc-900">/{cmd.command_name}</span>
                          <span className="flex-1 truncate text-[12px] text-zinc-500">{cmd.command_description}</span>
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500">
                            {(h % 80) + 6} runs
                          </span>
                          <span className="text-[10.5px] tabular-nums text-zinc-400">
                            {((h % 12) + 1)}h ago
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCommand(i)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                            aria-label="Remove command"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                          </button>
                        </m.li>
                      );
                    })}
                  </ul>
                )}
              </AnimatePresence>

              {commands.length < 30 && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCommandName}
                    onChange={(e) =>
                      setNewCommandName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())
                    }
                    placeholder="command_name"
                    className="w-44 rounded-xl font-mono"
                  />
                  <Input
                    value={newCommandDesc}
                    onChange={(e) => setNewCommandDesc(e.target.value)}
                    placeholder="Description of the command"
                    className="flex-1 rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCommand();
                      }
                    }}
                  />
                  <WaButton
                    variant="outline"
                    size="sm"
                    leftIcon={Plus}
                    onClick={addCommand}
                    disabled={!newCommandName.trim() || !newCommandDesc.trim()}
                  >
                    Add
                  </WaButton>
                </div>
              )}
            </Section>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-[12.5px] text-zinc-600">
                Resetting clears every welcome, ice-breaker, and command on Meta for this number.
              </p>
              <WaButton variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={isPending}>
                Reset automation
              </WaButton>
            </div>
          </div>

          {/* RIGHT - phone preview + run log */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle={previewSubtitle}>
              <AnimatePresence initial={false}>
                {welcomeEnabled && welcomeText.trim() && (
                  <m.div key="welcome" layout>
                    <ChatBubble who="them" text={welcomeText} time="9:41" />
                  </m.div>
                )}
                {prompts.length > 0 && (
                  <m.div
                    key="prompts"
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="flex flex-wrap gap-1.5 pt-1"
                  >
                    {prompts.map((p, i) => (
                      <m.span
                        key={p + i}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: i * 0.04 }}
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
                      >
                        {p}
                      </m.span>
                    ))}
                  </m.div>
                )}
                {commands.length > 0 && (
                  <m.div
                    key="cmds"
                    layout
                    className="mt-1 flex flex-wrap gap-1.5"
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  >
                    {commands.slice(0, 4).map((c, i) => (
                      <m.span
                        key={c.command_name + i}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: i * 0.04 }}
                        className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10.5px] text-emerald-100"
                      >
                        /{c.command_name}
                      </m.span>
                    ))}
                  </m.div>
                )}
                {!welcomeEnabled && prompts.length === 0 && commands.length === 0 && (
                  <ChatBubble
                    key="empty"
                    who="them"
                    text="Toggle the welcome message on the left to see it appear here."
                    time="9:41"
                  />
                )}
              </AnimatePresence>
            </PhoneFrame>

            <Section title="Recent runs" description="Last 6 automation events.">
              <ul className="divide-y divide-zinc-100">
                {recentRuns.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-1 py-2">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${r.ok ? 'bg-[#25D366]' : 'bg-rose-500'}`}
                    />
                    <span className="flex-1 truncate text-[12px] text-zinc-700">{r.label}</span>
                    <span className="text-[10.5px] tabular-nums text-zinc-400">{r.ago}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}

      {/* Train dialog */}
      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Train conversational AI</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add training samples that teach the AI how to respond. Saved samples become
              available the next time the assistant runs.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="train-question">Sample question</Label>
              <Input id="train-question" placeholder="What are your business hours?" className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="train-answer">Ideal answer</Label>
              <Textarea id="train-answer" placeholder="We are open Mon to Fri, 9am to 6pm IST." rows={3} className="rounded-xl" />
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="ghost" size="sm" onClick={() => setTrainOpen(false)}>
              Cancel
            </WaButton>
            <WaButton
              size="sm"
              onClick={() => {
                toast({ title: 'Saved', description: 'Training sample queued.' });
                setTrainOpen(false);
              }}
            >
              Save sample
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Reset confirm */}
      <ZoruAlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Reset automation?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All welcome messages, ice breakers and slash commands will be cleared from Meta for
              this number. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isPending}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction destructive onClick={handleReset} disabled={isPending}>
              {isPending ? 'Resetting...' : 'Yes, reset'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  reduced,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  reduced: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
      style={{ background: checked ? 'var(--mt-accent)' : '#e4e4e7' }}
    >
      <m.span
        layout
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        className={`block h-5 w-5 rounded-full bg-white shadow ${checked ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
      />
    </button>
  );
}
