"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  IconButton,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Field,
  Label,
  Switch,
  useToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/sabcrm/20ui";
import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Code,
  Copy,
  MessageSquare,
  Save,
  Palette,
  Settings2,
  FileText,
} from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import type { WithId, User, SabChatSettings } from "@/lib/definitions";

import { SabFileUrlInput } from "@/components/sabfiles";

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
      Save widget settings
    </Button>
  );
}

export function Ui20SabChatWidgetGenerator({
  user,
}: {
  user: WithId<User>;
}) {
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(
    saveSabChatSettings,
    initialState,
  );
  const { toast } = useToast();
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
      toast({ title: "Saved", description: state.message, tone: "success" });
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error || "An error occurred",
        tone: "danger",
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
      toast.success("Embed code copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const tabs = [
    { id: 'design' as const, label: 'Design', icon: Palette },
    { id: 'pre-chat' as const, label: 'Pre-chat form', icon: FileText },
    { id: 'advanced' as const, label: 'Advanced', icon: Settings2 },
  ];

  return (
    <Card>
      <form action={formAction}>
        <input type="hidden" name="_form" value="widget" />
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify(settings)}
        />
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <Code className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Widget configuration</CardTitle>
              <CardDescription>
                Customize and install the live chat widget on your website.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Sidebar Navigation */}
            <div
              role="tablist"
              aria-label="Widget settings sections"
              className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--st-border)] pb-4 lg:pb-0 lg:pr-4 overflow-x-auto"
            >
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    variant={active ? 'secondary' : 'ghost'}
                    iconLeft={tab.icon}
                    block
                    onClick={() => setActiveTab(tab.id)}
                    className="justify-start"
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {/* Customisation panel */}
            <div className="flex-1 space-y-6">

              {activeTab === 'design' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                    <Switch
                      id="widget-enabled"
                      checked={settings.enabled}
                      aria-label="Enable chat widget"
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
                    <Field label="Widget colour" id="widget-color">
                      <Input
                        type="color"
                        value={settings.widgetColor}
                        onChange={(e) =>
                          handleSettingChange("widgetColor", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Widget position">
                      <Select
                        value={settings.widgetPosition}
                        onValueChange={(v) => handleSettingChange("widgetPosition", v)}
                      >
                        <SelectTrigger aria-label="Widget position">
                          <SelectValue placeholder="Position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Dark mode">
                      <Select
                        value={settings.darkMode}
                        onValueChange={(v) => handleSettingChange("darkMode", v)}
                      >
                        <SelectTrigger aria-label="Dark mode">
                          <SelectValue placeholder="Theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="auto">Auto (System)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Channel name" id="widget-team-name">
                      <Input
                        value={settings.teamName}
                        onChange={(e) =>
                          handleSettingChange("teamName", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Welcome message" id="widget-welcome" className="sm:col-span-2">
                      <Textarea
                        value={settings.welcomeMessage}
                        onChange={(e) =>
                          handleSettingChange("welcomeMessage", e.target.value)
                        }
                        rows={2}
                      />
                    </Field>

                    <Field label="Welcome tagline" id="widget-tagline" className="sm:col-span-2">
                      <Input
                        value={settings.welcomeTagline}
                        onChange={(e) =>
                          handleSettingChange("welcomeTagline", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Agent avatar" id="widget-avatar">
                      <SabFileUrlInput
                        accept="image"
                        value={settings.avatarUrl ?? ""}
                        onChange={(v) =>
                          handleSettingChange("avatarUrl", v)
                        }
                      />
                    </Field>

                    <Field label="Company logo" id="widget-logo">
                      <SabFileUrlInput
                        accept="image"
                        value={settings.companyLogo ?? ""}
                        onChange={(v) =>
                          handleSettingChange("companyLogo", v)
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === 'pre-chat' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                    <Switch
                      id="prechat-enabled"
                      checked={settings.preChatFormEnabled}
                      aria-label="Enable pre-chat form"
                      onCheckedChange={(checked) =>
                        handleSettingChange("preChatFormEnabled", checked)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="prechat-enabled">
                        Enable pre-chat form
                      </Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        Collect visitor information before starting a conversation.
                      </p>
                    </div>
                  </div>

                  {settings.preChatFormEnabled && (
                    <div className="space-y-4 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <Field
                        label="Pre-chat message"
                        id="prechat-message"
                        help="Additional custom fields can be configured in your channel settings."
                      >
                        <Textarea
                          value={settings.preChatFormMessage}
                          onChange={(e) =>
                            handleSettingChange("preChatFormMessage", e.target.value)
                          }
                          placeholder="Please provide your details before we start."
                          rows={2}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-left-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-csat">Customer satisfaction (CSAT)</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Send a survey after the conversation resolves.</p>
                      </div>
                      <Switch
                        id="adv-csat"
                        checked={settings.csatSurveyEnabled}
                        aria-label="Customer satisfaction (CSAT)"
                        onCheckedChange={(c) => handleSettingChange("csatSurveyEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-attachments">File attachments</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Allow visitors to send files.</p>
                      </div>
                      <Switch
                        id="adv-attachments"
                        checked={settings.fileAttachmentsEnabled}
                        aria-label="File attachments"
                        onCheckedChange={(c) => handleSettingChange("fileAttachmentsEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-emoji">Emoji picker</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Show the emoji picker in the widget input.</p>
                      </div>
                      <Switch
                        id="adv-emoji"
                        checked={settings.emojiPickerEnabled}
                        aria-label="Emoji picker"
                        onCheckedChange={(c) => handleSettingChange("emojiPickerEnabled", c)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                      <div className="space-y-1">
                        <Label htmlFor="adv-consent">Require consent</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Show a consent disclaimer.</p>
                      </div>
                      <Switch
                        id="adv-consent"
                        checked={settings.requireConsent}
                        aria-label="Require consent"
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
                        aria-label="Hide outside business hours"
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
                                <AvatarImage src={settings.avatarUrl} alt={settings.teamName} />
                              )}
                              <AvatarFallback className="bg-white/10 text-white">
                                {settings.teamName?.charAt(0) || "S"}
                              </AvatarFallback>
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
                              <AvatarImage src={settings.avatarUrl} alt={settings.teamName} />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {settings.teamName?.charAt(0) || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`rounded-2xl rounded-tl-sm px-4 py-2 text-sm ${settings.darkMode === 'dark' ? 'bg-[var(--st-text)] text-white' : 'bg-white text-[var(--st-text)]'} shadow-sm`}>
                            {settings.welcomeMessage}
                          </div>
                        </div>

                        {settings.preChatFormEnabled && (
                          <div className={`mt-4 rounded-xl border p-4 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-white'}`}>
                            <p className="mb-3 text-sm font-medium">{settings.preChatFormMessage}</p>
                            <div className="space-y-3">
                              <Input aria-label="Your name" className={settings.darkMode === 'dark' ? 'bg-[var(--st-text)] border-[var(--st-border)]' : ''} placeholder="Your name" />
                              <Input aria-label="Your email" className={settings.darkMode === 'dark' ? 'bg-[var(--st-text)] border-[var(--st-border)]' : ''} placeholder="Your email" />
                              <Button block className="text-white" style={{ backgroundColor: settings.widgetColor }}>Start conversation</Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`border-t p-3 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-white'}`}>
                        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 ${settings.darkMode === 'dark' ? 'border-[var(--st-border)] bg-[var(--st-text)]' : 'border-[var(--st-border)] bg-[var(--st-bg-muted)]'}`}>
                          <Input
                            aria-label="Type a message (preview)"
                            placeholder="Type a message..."
                            className="flex-1 border-0 bg-transparent text-sm"
                            disabled={settings.preChatFormEnabled}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <IconButton
                    label="Toggle widget preview"
                    icon={MessageSquare}
                    style={{ backgroundColor: settings.widgetColor }}
                    onClick={() => setShowWidget(!showWidget)}
                    className="relative h-14 w-14 shrink-0 rounded-full text-white shadow-lg transition-transform hover:scale-105"
                  />
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
                  <IconButton
                    label="Copy embed code"
                    icon={Copy}
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter className="border-t border-[var(--st-border)] pt-6">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
