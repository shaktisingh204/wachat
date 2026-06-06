"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Switch,
  Textarea,
  useZoruToast,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Slider,
  Input,
  Badge,
  ZoruTooltipProvider,
  ZoruTooltip,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
  Tabs,
  ZoruTabsList,
  ZoruTabsTrigger,
  ZoruTabsContent,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Bot,
  LoaderCircle,
  Save,
  Wand2,
  Settings2,
  Globe,
  MessageSquare,
  ShieldAlert,
  Send,
  User,
  Sparkles,
  Plus
} from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/sabchat/ai-replies — AI assistant configuration.
 */

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save AI Configuration
    </Button>
  );
}

export default function SabChatAiRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const settings = sessionUser?.sabChatSettings || {};
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(saveSabChatSettings, initialState);
  const { toast } = useZoruToast();
  
  // Local state for interactive elements
  const [persona, setPersona] = useState(settings.aiPersona || "professional");
  const [testMessage, setTestMessage] = useState("");
  const [testHistory, setTestHistory] = useState([
    { sender: 'bot', text: "Hello! I am your AI assistant. How can I help you today?" }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [confidence, setConfidence] = useState([80]);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Saved", description: state.message });
      reloadProject();
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, reloadProject]);

  const handleTestChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    
    setTestHistory(prev => [...prev, { sender: 'user', text: testMessage }]);
    setTestMessage("");
    setIsSimulating(true);
    
    setTimeout(() => {
      let reply = "I understand. I am an AI assistant.";
      if (persona === 'friendly') reply = "Gotcha! I'd love to help you with that! ✨";
      if (persona === 'humorous') reply = "Well that's a pickle! Let me see what my circuits can do for you. 🤖";
      
      setTestHistory(prev => [...prev, { sender: 'bot', text: reply }]);
      setIsSimulating(false);
    }, 1000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>AI Assistant Engine</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <div className="flex items-center gap-3">
            <ZoruPageTitle>AI Assistant Engine</ZoruPageTitle>
            <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
              <Sparkles className="h-3 w-3 mr-1" /> Premium
            </Badge>
          </div>
          <ZoruPageDescription>
            Configure your intelligent chatbot to resolve queries automatically before they reach human agents.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <form action={formAction}>
        <input type="hidden" name="_form" value="ai-replies" />
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
              <ZoruCardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <ZoruCardTitle>Core Engine Status</ZoruCardTitle>
                    <ZoruCardDescription>Enable or disable the AI deflection system globally.</ZoruCardDescription>
                  </div>
                  <div className="ml-auto">
                    <Switch
                      id="aiEnabled"
                      name="aiEnabled"
                      defaultChecked={settings.aiEnabled}
                      className="data-[state=checked]:bg-[var(--st-text)]"
                    />
                  </div>
                </div>
              </ZoruCardHeader>
            </Card>

            <Tabs defaultValue="context" className="w-full">
              <ZoruTabsList className="w-full justify-start border-b rounded-none px-4 h-12 bg-transparent">
                <ZoruTabsTrigger value="context" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Knowledge Context</ZoruTabsTrigger>
                <ZoruTabsTrigger value="persona" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Persona & Tone</ZoruTabsTrigger>
                <ZoruTabsTrigger value="behavior" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Routing Behavior</ZoruTabsTrigger>
              </ZoruTabsList>
              
              <Card className="border-t-0 rounded-tl-none">
                
                {/* Knowledge Context Tab */}
                <ZoruTabsContent value="context" className="p-6 m-0 outline-none space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="aiContext">Business Base Context</Label>
                    <Textarea
                      id="aiContext"
                      name="aiContext"
                      defaultValue={settings.aiContext || ""}
                      className="min-h-[160px] font-mono text-sm leading-relaxed"
                      placeholder="We are Acme Corp. We sell widgets. Our refund policy is 30 days..."
                    />
                    <p className="text-xs text-[var(--st-text-secondary)]">
                      This is the foundational prompt injected into every AI conversation.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Website Crawler Setup</Label>
                    <div className="flex items-center gap-2">
                      <Input placeholder="https://example.com/docs" />
                      <Button type="button" variant="outline"><Globe className="h-4 w-4 mr-2" /> Crawl & Sync</Button>
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)]">Automatically update the AI's knowledge by crawling your documentation site daily.</p>
                  </div>
                </ZoruTabsContent>

                {/* Persona Tab */}
                <ZoruTabsContent value="persona" className="p-6 m-0 outline-none space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Brand Tone & Persona</Label>
                      <Select value={persona} onValueChange={setPersona}>
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Select persona" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="professional">Professional & Direct</ZoruSelectItem>
                          <ZoruSelectItem value="friendly">Friendly & Empathetic</ZoruSelectItem>
                          <ZoruSelectItem value="humorous">Humorous & Witty</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                      <p className="text-xs text-[var(--st-text-secondary)] mt-2 block">
                        Preview: <span className="italic">
                          {persona === 'professional' && "Hello, how may I assist you today?"}
                          {persona === 'friendly' && "Hi there! I'd love to help you out with that!"}
                          {persona === 'humorous' && "Greetings, human! What kind of trouble are we getting into?"}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Response Verbosity</Label>
                      <Select defaultValue={settings.aiResponseLength || "medium"}>
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Select length" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="short">Short (1-2 sentences)</ZoruSelectItem>
                          <ZoruSelectItem value="medium">Medium (Balanced)</ZoruSelectItem>
                          <ZoruSelectItem value="detailed">Detailed & Explanatory</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Supported Languages</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)]">English (Primary)</Badge>
                      <Badge variant="outline">Spanish</Badge>
                      <Badge variant="outline">French</Badge>
                      <Badge variant="outline">German</Badge>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2"><Plus className="h-3 w-3 mr-1" /> Add Language</Button>
                    </div>
                  </div>
                </ZoruTabsContent>

                {/* Routing Behavior Tab */}
                <ZoruTabsContent value="behavior" className="p-6 m-0 outline-none space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Confidence Threshold: {confidence}%</Label>
                    </div>
                    <Slider 
                      defaultValue={confidence} 
                      max={100} 
                      step={5} 
                      onValueChange={setConfidence}
                      className="py-4"
                    />
                    <p className="text-xs text-[var(--st-text-secondary)]">
                      If the AI is less than {confidence}% confident in its answer, it will trigger the fallback rule.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Label>Fallback Rule (Human Handoff)</Label>
                    <Select defaultValue={settings.aiFallbackAction || "handoff_to_human"}>
                      <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Select fallback rule" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="handoff_to_human">Route to Human Agent instantly</ZoruSelectItem>
                        <ZoruSelectItem value="escalate">Create high-priority support ticket</ZoruSelectItem>
                        <ZoruSelectItem value="continue">Force AI to try answering anyway</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Handoff Message</Label>
                    <Input defaultValue="I'm transferring you to a human agent who can better assist you with this request. Please hold on." />
                    <p className="text-xs text-[var(--st-text-secondary)]">Displayed to the visitor when routing to a human.</p>
                  </div>
                </ZoruTabsContent>

              </Card>
            </Tabs>

            <div className="flex justify-end pt-4">
              <SubmitButton />
            </div>
          </div>

          {/* Right Column: AI Sandbox */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="h-[600px] flex flex-col border-[var(--st-border)] dark:border-[var(--st-border)]/50 shadow-md">
                <ZoruCardHeader className="border-b border-[var(--st-border)] py-4 bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/20">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-[var(--st-text)]" />
                    <ZoruCardTitle className="text-base text-[var(--st-text)] dark:text-white">AI Sandbox</ZoruCardTitle>
                  </div>
                  <ZoruCardDescription className="text-xs">
                    Test your current configuration in real-time.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                
                <ZoruCardContent className="flex-1 p-0 flex flex-col bg-[var(--st-bg-muted)]/30">
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {testHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
                          msg.sender === 'bot' 
                            ? 'bg-white dark:bg-[var(--st-bg)] border border-[var(--st-border)] text-[var(--st-text)]' 
                            : 'bg-[var(--st-text)] text-white'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isSimulating && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-[var(--st-bg)] border border-[var(--st-border)] rounded-lg p-3 text-sm shadow-sm flex items-center gap-1">
                          <span className="h-2 w-2 bg-[var(--st-bg-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-2 w-2 bg-[var(--st-bg-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-2 w-2 bg-[var(--st-bg-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 bg-white dark:bg-[var(--st-bg)] border-t border-[var(--st-border)]">
                    <form onSubmit={handleTestChat} className="flex items-center gap-2">
                      <Input 
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Message AI..." 
                        className="flex-1 bg-[var(--st-bg-muted)] border-0"
                      />
                      <Button type="submit" size="icon-sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white rounded-full h-8 w-8">
                        <Send className="h-3 w-3" />
                      </Button>
                    </form>
                  </div>
                </ZoruCardContent>
              </Card>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
