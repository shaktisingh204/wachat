"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  IconButton,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  Switch,
  Slider,
  Badge,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/components/sabcrm/20ui";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Bot,
  LoaderCircle,
  Save,
  Wand2,
  Globe,
  Send,
  Sparkles,
  Plus,
} from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/sabchat/ai-replies - AI assistant configuration.
 */

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      iconLeft={pending ? LoaderCircle : Save}
    >
      Save AI Configuration
    </Button>
  );
}

export default function SabChatAiRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const settings = sessionUser?.sabChatSettings || {};
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(saveSabChatSettings, initialState);
  const { toast } = useToast();

  // Local state for interactive elements
  const [persona, setPersona] = useState(settings.aiPersona || "professional");
  const [aiEnabled, setAiEnabled] = useState<boolean>(Boolean(settings.aiEnabled));
  const [testMessage, setTestMessage] = useState("");
  const [testHistory, setTestHistory] = useState([
    { sender: "bot", text: "Hello! I am your AI assistant. How can I help you today?" },
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [confidence, setConfidence] = useState(80);

  useEffect(() => {
    if (state.message) {
      toast.success({ title: "Saved", description: state.message });
      reloadProject();
    }
    if (state.error) {
      toast.error({ title: "Error", description: state.error });
    }
  }, [state, toast, reloadProject]);

  const handleTestChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    setTestHistory((prev) => [...prev, { sender: "user", text: testMessage }]);
    setTestMessage("");
    setIsSimulating(true);

    setTimeout(() => {
      let reply = "I understand. I am an AI assistant.";
      if (persona === "friendly") reply = "Gotcha! I'd love to help you with that!";
      if (persona === "humorous")
        reply = "Well that's a pickle. Let me see what my circuits can do for you.";

      setTestHistory((prev) => [...prev, { sender: "bot", text: reply }]);
      setIsSimulating(false);
    }, 1000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">SabChat</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>AI Assistant Engine</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <div className="flex items-center gap-3">
            <PageTitle>AI Assistant Engine</PageTitle>
            <Badge tone="accent" kind="soft" dot>
              <Sparkles className="h-3 w-3 mr-1" /> Premium
            </Badge>
          </div>
          <PageDescription>
            Configure your intelligent chatbot to resolve queries automatically before
            they reach human agents.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <form action={formAction}>
        <input type="hidden" name="_form" value="ai-replies" />
        {/* The AI toggle is a 20ui Switch (a button, not a native checkbox), so
            mirror its state into a hidden input the action can read; omitted when
            off so `formData.get('aiEnabled') === 'on'` evaluates false. */}
        {aiEnabled ? <input type="hidden" name="aiEnabled" value="on" /> : null}
        {/* Pass-through existing settings unrelated to this form. */}
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify({
            enabled: settings.enabled,
            widgetColor: settings.widgetColor,
            welcomeMessage: settings.welcomeMessage,
            awayMessage: settings.awayMessage,
            teamName: settings.teamName,
            avatarUrl: settings.avatarUrl,
            officeHours: settings.officeHours,
            faqs: settings.faqs,
            quickReplies: settings.quickReplies,
            aiPersona: persona,
            aiFallbackAction: settings.aiFallbackAction,
            aiResponseLength: settings.aiResponseLength,
          })}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Core Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>Core Engine Status</CardTitle>
                    <CardDescription>
                      Enable or disable the AI deflection system globally.
                    </CardDescription>
                  </div>
                  <div className="ml-auto">
                    <Switch
                      checked={aiEnabled}
                      onCheckedChange={setAiEnabled}
                      aria-label="Enable AI deflection engine"
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="context" className="w-full">
              <TabsList>
                <TabsTrigger value="context">Knowledge Context</TabsTrigger>
                <TabsTrigger value="persona">Persona & Tone</TabsTrigger>
                <TabsTrigger value="behavior">Routing Behavior</TabsTrigger>
              </TabsList>

              <Card>
                {/* Knowledge Context Tab */}
                <TabsContent value="context" className="p-6 m-0 outline-none space-y-6">
                  <Field
                    label="Business Base Context"
                    help="This is the foundational prompt injected into every AI conversation."
                  >
                    <Textarea
                      name="aiContext"
                      defaultValue={settings.aiContext || ""}
                      className="min-h-[160px] font-mono text-sm leading-relaxed"
                      placeholder="We are Acme Corp. We sell widgets. Our refund policy is 30 days..."
                    />
                  </Field>

                  <Field
                    label="Website Crawler Setup"
                    help="Automatically update the AI's knowledge by crawling your documentation site daily."
                  >
                    <div className="flex items-center gap-2">
                      <Input placeholder="https://example.com/docs" className="flex-1" />
                      <Button type="button" variant="outline" iconLeft={Globe}>
                        Crawl & Sync
                      </Button>
                    </div>
                  </Field>
                </TabsContent>

                {/* Persona Tab */}
                <TabsContent value="persona" className="p-6 m-0 outline-none space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <Field
                      label="Brand Tone & Persona"
                      help={
                        <>
                          Preview:{" "}
                          <span className="italic">
                            {persona === "professional" &&
                              "Hello, how may I assist you today?"}
                            {persona === "friendly" &&
                              "Hi there! I'd love to help you out with that!"}
                            {persona === "humorous" &&
                              "Greetings, human! What kind of trouble are we getting into?"}
                          </span>
                        </>
                      }
                    >
                      <Select value={persona} onValueChange={setPersona}>
                        <SelectTrigger aria-label="Brand tone and persona">
                          <SelectValue placeholder="Select persona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional & Direct</SelectItem>
                          <SelectItem value="friendly">Friendly & Empathetic</SelectItem>
                          <SelectItem value="humorous">Humorous & Witty</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Response Verbosity">
                      <Select defaultValue={settings.aiResponseLength || "medium"}>
                        <SelectTrigger aria-label="Response verbosity">
                          <SelectValue placeholder="Select length" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                          <SelectItem value="medium">Medium (Balanced)</SelectItem>
                          <SelectItem value="detailed">Detailed & Explanatory</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Supported Languages">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent" kind="soft">
                        English (Primary)
                      </Badge>
                      <Badge tone="neutral" kind="outline">
                        Spanish
                      </Badge>
                      <Badge tone="neutral" kind="outline">
                        French
                      </Badge>
                      <Badge tone="neutral" kind="outline">
                        German
                      </Badge>
                      <Button type="button" variant="ghost" size="sm" iconLeft={Plus}>
                        Add Language
                      </Button>
                    </div>
                  </Field>
                </TabsContent>

                {/* Routing Behavior Tab */}
                <TabsContent value="behavior" className="p-6 m-0 outline-none space-y-8">
                  <Field
                    label={`Confidence Threshold: ${confidence}%`}
                    help={`If the AI is less than ${confidence}% confident in its answer, it will trigger the fallback rule.`}
                  >
                    <Slider
                      value={confidence}
                      max={100}
                      step={5}
                      onValueChange={(v) => setConfidence(Array.isArray(v) ? v[0] : v)}
                      ariaLabel="Confidence threshold"
                      className="py-4"
                    />
                  </Field>

                  <Field label="Fallback Rule (Human Handoff)">
                    <Select defaultValue={settings.aiFallbackAction || "handoff_to_human"}>
                      <SelectTrigger aria-label="Fallback rule">
                        <SelectValue placeholder="Select fallback rule" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="handoff_to_human">
                          Route to Human Agent instantly
                        </SelectItem>
                        <SelectItem value="escalate">
                          Create high-priority support ticket
                        </SelectItem>
                        <SelectItem value="continue">
                          Force AI to try answering anyway
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    label="Handoff Message"
                    help="Displayed to the visitor when routing to a human."
                  >
                    <Input defaultValue="I'm transferring you to a human agent who can better assist you with this request. Please hold on." />
                  </Field>
                </TabsContent>
              </Card>
            </Tabs>

            <div className="flex justify-end pt-4">
              <SubmitButton />
            </div>
          </div>

          {/* Right Column: AI Sandbox */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card padding="none" className="h-[600px] flex flex-col">
                <CardHeader className="border-b border-[var(--st-border)] py-4 bg-[var(--st-bg-secondary)]">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-[var(--st-text)]" />
                    <CardTitle className="text-base">AI Sandbox</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Test your current configuration in real-time.
                  </CardDescription>
                </CardHeader>

                <CardBody className="flex-1 p-0 flex flex-col bg-[var(--st-bg-secondary)]">
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {testHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-[var(--st-radius)] p-3 text-sm shadow-[var(--st-shadow-sm)] ${
                            msg.sender === "bot"
                              ? "bg-[var(--st-bg)] border border-[var(--st-border)] text-[var(--st-text)]"
                              : "bg-[var(--st-text)] text-[var(--st-bg)]"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isSimulating && (
                      <div className="flex justify-start">
                        <div className="bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-3 text-sm shadow-[var(--st-shadow-sm)] flex items-center gap-1">
                          <span className="h-2 w-2 bg-[var(--st-text-secondary)] rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 bg-[var(--st-text-secondary)] rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 bg-[var(--st-text-secondary)] rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-[var(--st-bg)] border-t border-[var(--st-border)]">
                    <form onSubmit={handleTestChat} className="flex items-center gap-2">
                      <Input
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Message AI..."
                        aria-label="Test message"
                        className="flex-1"
                      />
                      <IconButton
                        type="submit"
                        variant="primary"
                        label="Send test message"
                        icon={Send}
                      />
                    </form>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
