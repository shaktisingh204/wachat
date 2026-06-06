"use client";

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Switch,
  Textarea,
  useZoruToast,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useMemo,
  useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Code,
  Copy,
  LoaderCircle,
  MessageSquare,
  Save,
  Palette,
  Settings2,
  FileText } from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import type { WithId,
  User,
  SabChatSettings } from "@/lib/definitions";

import { SabFileUrlInput } from "@/components/sabfiles";

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Save />
      )}
      Save widget settings
    </Button>
  );
}

export function ZoruSabChatWidgetGenerator({
  user,
}: {
  user: WithId<User>;
}) {
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(
    saveSabChatSettings,
    initialState,
  );
  const { toast } = useZoruToast();
  const [showWidget, setShowWidget] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'pre-chat' | 'advanced'>('design');

  const [settings, setSettings] = useState<SabChatSettings>(() => ({
    enabled: user.sabChatSettings?.enabled ?? true,
    widgetColor: user.sabChatSettings?.widgetColor || "#1f2937",
    widgetPosition: user.sabChatSettings?.widgetPosition || "right",
    darkMode: user.sabChatSettings?.darkMode || "auto",
    welcomeMessage:
      user.sabChatSettings?.welcomeMessage ||
      "Hello! How can we help you today?",
    welcomeTagline: user.sabChatSettings?.welcomeTagline || "Typically replies instantly",
    teamName: user.sabChatSettings?.teamName || user.name,
    avatarUrl: user.sabChatSettings?.avatarUrl || "",
    companyLogo: user.sabChatSettings?.companyLogo || "",
    awayMessage:
      user.sabChatSettings?.awayMessage ||
      "We are currently away. Please leave a message!",
    replyTime: user.sabChatSettings?.replyTime || "Typically replies in a few minutes",
    preChatFormEnabled: user.sabChatSettings?.preChatFormEnabled ?? false,
    preChatFormMessage: user.sabChatSettings?.preChatFormMessage || "Please provide your details before we start.",
    csatSurveyEnabled: user.sabChatSettings?.csatSurveyEnabled ?? false,
    fileAttachmentsEnabled: user.sabChatSettings?.fileAttachmentsEnabled ?? true,
    emojiPickerEnabled: user.sabChatSettings?.emojiPickerEnabled ?? true,
    requireConsent: user.sabChatSettings?.requireConsent ?? false,
    hideOutsideBusinessHours: user.sabChatSettings?.hideOutsideBusinessHours ?? false,
  }));

  useEffect(() => {
    if (state.message) {
      toast({ title: "Saved", description: state.message });
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error || "An error occurred",
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handleSettingChange = (
    field: keyof SabChatSettings,
    value: any,
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const embedCode = useMemo(() => {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `<script src="${appUrl}/api/sabchat/${user._id.toString()}" async defer></script>`;
  }, [user._id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast({
        title: "Copied",
        description: "Embed code copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <form action={formAction}>
        <input type="hidden" name="_form" value="widget" />
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify(settings)}
        />
        <ZoruCardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <Code className="h-4 w-4" />
            </span>
            <div>
              <ZoruCardTitle>Widget configuration</ZoruCardTitle>
              <ZoruCardDescription>
                Customize and install the live chat widget on your website.
              </ZoruCardDescription>
            </div>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Sidebar Navigation */}
            <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--st-border)] pb-4 lg:pb-0 lg:pr-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('design')}
                className={`flex items-center gap-2 rounded-[var(--st-radius-sm)] px-3 py-2 text-sm transition-colors ${activeTab === 'design' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium' : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]'}`}
              >
                <Palette className="h-4 w-4 shrink-0" />
                Design
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pre-chat')}
                className={`flex items-center gap-2 rounded-[var(--st-radius-sm)] px-3 py-2 text-sm transition-colors ${activeTab === 'pre-chat' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium' : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]'}`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                Pre-chat form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('advanced')}
                className={`flex items-center gap-2 rounded-[var(--st-radius-sm)] px-3 py-2 text-sm transition-colors ${activeTab === 'advanced' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium' : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]'}`}
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                Advanced
              </button>
            </div>

            {/* Customisation panel */}
            <div className="flex-1 space-y-6">
              
              {activeTab === 'design' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                    <Switch
                      id="widget-enabled"
                      checked={settings.enabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange("enabled", checked)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="widget-enabled">
                        Enable chat widget
                      </Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        {settings.enabled
                          ? "Widget is active and visible on your site."
                          : "Widget is disabled and hidden from your site."}
                      </p>
                    </div>
                    {settings.enabled && (
                      <input type="hidden" name="enabled" value="on" />
                    )}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="widget-color">Widget colour</Label>
                      <Input
                        id="widget-color"
                        type="color"
                        value={settings.widgetColor}
                        onChange={(e) =>
                          handleSettingChange("widgetColor", e.target.value)
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Widget position</Label>
                      <Select
                        value={settings.widgetPosition}
                        onValueChange={(v) => handleSettingChange("widgetPosition", v)}
                      >
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Position" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="left">Left</ZoruSelectItem>
                          <ZoruSelectItem value="right">Right</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Dark mode</Label>
                      <Select
                        value={settings.darkMode}
                        onValueChange={(v) => handleSettingChange("darkMode", v)}
                      >
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Theme" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="light">Light</ZoruSelectItem>
                          <ZoruSelectItem value="dark">Dark</ZoruSelectItem>
                          <ZoruSelectItem value="auto">Auto (System)</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="widget-team-name">Channel name</Label>
                      <Input
                        id="widget-team-name"
                        value={settings.teamName}
                        onChange={(e) =>
                          handleSettingChange("teamName", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="widget-welcome">Welcome message</Label>
                      <Textarea
                        id="widget-welcome"
                        value={settings.welcomeMessage}
                        onChange={(e) =>
                          handleSettingChange("welcomeMessage", e.target.value)
                        }
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="widget-tagline">Welcome tagline</Label>
                      <Input
                        id="widget-tagline"
                        value={settings.welcomeTagline}
                        onChange={(e) =>
                          handleSettingChange("welcomeTagline", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="widget-avatar">Agent Avatar</Label>
                      <SabFileUrlInput
                        id="widget-avatar"
                        accept="image"
                        value={settings.avatarUrl ?? ""}
                        onChange={(v) =>
                          handleSettingChange("avatarUrl", v)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="widget-logo">Company Logo</Label>
                      <SabFileUrlInput
                        id="widget-logo"
                        accept="image"
                        value={settings.companyLogo ?? ""}
                        onChange={(v) =>
                          handleSettingChange("companyLogo", v)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pre-chat' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                    <Switch
                      id="prechat-enabled"
                      checked={settings.preChatFormEnabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange("preChatFormEnabled", checked)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="prechat-enabled">
                        Enable Pre-chat Form
                      </Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        Collect visitor information before starting a conversation.
                      </p>
                    </div>
                  </div>

                  {settings.preChatFormEnabled && (
                    <div className="space-y-4 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-2">
                        <Label htmlFor="prechat-message">Pre-chat Message</Label>
                        <Textarea
                          id="prechat-message"
                          value={settings.preChatFormMessage}
                          onChange={(e) =>
                            handleSettingChange("preChatFormMessage", e.target.value)
                          }
                          placeholder="Please provide your details before we start."
                          rows={2}
                        />
                      </div>
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        (Additional custom fields management can be configured in your channel settings)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-csat">Customer Satisfaction (CSAT)</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Send a survey after conversation resolves.</p>
                      </div>
                      <Switch
                        id="adv-csat"
                        checked={settings.csatSurveyEnabled}
                        onCheckedChange={(c) => handleSettingChange("csatSurveyEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-attachments">File Attachments</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Allow visitors to send files.</p>
                      </div>
                      <Switch
                        id="adv-attachments"
                        checked={settings.fileAttachmentsEnabled}
                        onCheckedChange={(c) => handleSettingChange("fileAttachmentsEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-emoji">Emoji Picker</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Show emoji picker in widget input.</p>
                      </div>
                      <Switch
                        id="adv-emoji"
                        checked={settings.emojiPickerEnabled}
                        onCheckedChange={(c) => handleSettingChange("emojiPickerEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-consent">Require Consent</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Show a consent disclaimer.</p>
                      </div>
                      <Switch
                        id="adv-consent"
                        checked={settings.requireConsent}
                        onCheckedChange={(c) => handleSettingChange("requireConsent", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-hours">Hide outside business hours</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Widget will be invisible when offline.</p>
                      </div>
                      <Switch
                        id="adv-hours"
                        checked={settings.hideOutsideBusinessHours}
                        onCheckedChange={(c) => handleSettingChange("hideOutsideBusinessHours", c)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview + code */}
            <div className="w-full lg:w-[350px] shrink-0 space-y-4">
              <Label>Live preview</Label>
              <div className="relative flex h-[500px] w-full items-end justify-end overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#374151_1px,transparent_1px)]">
                <div className={`static w-full h-full flex flex-col ${settings.widgetPosition === 'left' ? 'items-start' : 'items-end'} justify-end`}>
                  
                  {showWidget && (
                    <div className={`mb-4 flex h-[400px] w-[320px] flex-col overflow-hidden rounded-xl border border-[var(--st-border)] ${settings.darkMode === 'dark' ? 'bg-[var(--st-text)] text-white' : 'bg-white text-[var(--st-text)]'} shadow-[0_8px_30px_rgb(0,0,0,0.12)]`}>
                      <div
                        style={{ backgroundColor: settings.widgetColor }}
                        className="flex flex-col gap-3 p-5 text-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white/20">
                              {settings.avatarUrl && (
                                <ZoruAvatarImage src={settings.avatarUrl} />
                              )}
                              <ZoruAvatarFallback className="bg-white/10 text-white">
                                {settings.teamName?.charAt(0) || "S"}
                              </ZoruAvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold leading-tight">{settings.teamName}</h4>
                              {settings.welcomeTagline && (
                                <p className="text-xs opacity-90">{settings.welcomeTagline}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`flex-1 overflow-y-auto p-4 ${settings.darkMode === 'dark' ? 'bg-[var(--st-text)]' : 'bg-[var(--st-bg-muted)]'}`}>
                        <div className="flex gap-2">
                          <Avatar className="h-6 w-6 mt-1">
                            {settings.avatarUrl && (
                              <ZoruAvatarImage src={settings.avatarUrl} />
                            )}
                            <ZoruAvatarFallback className="text-[10px]">
                              {settings.teamName?.charAt(0) || "S"}
                            </ZoruAvatarFallback>
                          </Avatar>
                          <div className={`rounded-2xl rounded-tl-sm px-4 py-2 text-sm ${settings.darkMode === 'dark' ? 'bg-[var(--st-text)] text-white' : 'bg-white text-[var(--st-text)]'} shadow-sm`}>
                            {settings.welcomeMessage}
                          </div>
                        </div>

                        {settings.preChatFormEnabled && (
                          <div className={`mt-4 rounded-xl border p-4 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-white'}`}>
                            <p className="mb-3 text-sm font-medium">{settings.preChatFormMessage}</p>
                            <div className="space-y-3">
                              <Input className={settings.darkMode === 'dark' ? 'bg-[var(--st-text)] border-[var(--st-border)]' : ''} placeholder="Your name" />
                              <Input className={settings.darkMode === 'dark' ? 'bg-[var(--st-text)] border-[var(--st-border)]' : ''} placeholder="Your email" />
                              <Button className="w-full text-white" style={{ backgroundColor: settings.widgetColor }}>Start Conversation</Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`border-t p-3 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-white'}`}>
                        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-[var(--st-bg-muted)]'}`}>
                          <input 
                            placeholder="Type a message..." 
                            className="flex-1 bg-transparent text-sm outline-none" 
                            disabled={settings.preChatFormEnabled} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    style={{ backgroundColor: settings.widgetColor }}
                    onClick={() => setShowWidget(!showWidget)}
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
                    aria-label="Toggle widget preview"
                  >
                    <MessageSquare className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 pt-4">
                <Label htmlFor="widget-embed">Embed code</Label>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Copy and paste this code before the closing &lt;/body&gt; tag
                  on your website.
                </p>
                <div className="flex items-start gap-2">
                  <pre
                    id="widget-embed"
                    className="flex-1 overflow-x-auto rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-mono text-[10px] text-[var(--st-text)]"
                  >
                    {embedCode}
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={handleCopy}
                    aria-label="Copy embed code"
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter className="border-t border-[var(--st-border)] pt-6">
          <SubmitButton />
        </ZoruCardFooter>
      </form>
    </Card>
  );
}
