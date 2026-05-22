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
} from '@/components/zoruui';
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
  Save } from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import type { WithId,
  User,
  SabChatSettings } from "@/lib/definitions";

/**
 * ZoruUI rebuild of the SabChat widget generator.
 *
 * Same `saveSabChatSettings` server action wired through `useActionState`.
 * Pure visual swap — local component lives under `_components/` to avoid
 * importing visual primitives from `@/components/wabasimplify`.
 */

import { SabFileUrlInput } from "@/components/sabfiles";

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Save />
      )}
      Save widget settings
    </ZoruButton>
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

  const [settings, setSettings] = useState<SabChatSettings>(() => ({
    enabled: user.sabChatSettings?.enabled ?? true,
    widgetColor: user.sabChatSettings?.widgetColor || "#1f2937",
    welcomeMessage:
      user.sabChatSettings?.welcomeMessage ||
      "Hello! How can we help you today?",
    teamName: user.sabChatSettings?.teamName || user.name,
    avatarUrl: user.sabChatSettings?.avatarUrl || "",
    awayMessage:
      user.sabChatSettings?.awayMessage ||
      "We are currently away. Please leave a message!",
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
    value: string | boolean,
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
    <ZoruCard>
      <form action={formAction}>
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify(settings)}
        />
        <ZoruCardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted">
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
          <div className="grid items-start gap-8 lg:grid-cols-2">
            {/* Customisation panel */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
                <ZoruSwitch
                  id="widget-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("enabled", checked)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <ZoruLabel htmlFor="widget-enabled">
                    Enable chat widget
                  </ZoruLabel>
                  <p className="text-sm text-zoru-ink-muted">
                    {settings.enabled
                      ? "Widget is active and visible on your site."
                      : "Widget is disabled and hidden from your site."}
                  </p>
                </div>
                {/* Action expects 'enabled' to be 'on' if checked. */}
                {settings.enabled && (
                  <input type="hidden" name="enabled" value="on" />
                )}
              </div>

              <div className="space-y-2">
                <ZoruLabel htmlFor="widget-color">Widget colour</ZoruLabel>
                <ZoruInput
                  id="widget-color"
                  type="color"
                  value={settings.widgetColor}
                  onChange={(e) =>
                    handleSettingChange("widgetColor", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="widget-team-name">Team name</ZoruLabel>
                <ZoruInput
                  id="widget-team-name"
                  value={settings.teamName}
                  onChange={(e) =>
                    handleSettingChange("teamName", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="widget-welcome">Welcome message</ZoruLabel>
                <ZoruTextarea
                  id="widget-welcome"
                  value={settings.welcomeMessage}
                  onChange={(e) =>
                    handleSettingChange("welcomeMessage", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="widget-avatar">Avatar URL</ZoruLabel>
                <SabFileUrlInput
                  id="widget-avatar"
                  accept="image"
                  value={settings.avatarUrl ?? ""}
                  onChange={(v) =>
                    handleSettingChange("avatarUrl", v)
                  }
                />
              </div>
            </div>

            {/* Preview + code */}
            <div className="space-y-4">
              <ZoruLabel>Live preview</ZoruLabel>
              <div className="relative flex h-[400px] items-end justify-end overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
                <div className="static">
                  <button
                    type="button"
                    style={{ backgroundColor: settings.widgetColor }}
                    onClick={() => setShowWidget(!showWidget)}
                    className="relative flex h-16 w-16 items-center justify-center rounded-full text-zoru-on-primary shadow-[var(--zoru-shadow-md)]"
                    aria-label="Toggle widget preview"
                  >
                    <MessageSquare className="h-8 w-8" />
                  </button>
                  {showWidget && (
                    <div className="absolute bottom-[96px] right-[16px] flex h-[300px] w-[350px] flex-col overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow-lg)]">
                      <div
                        style={{ backgroundColor: settings.widgetColor }}
                        className="flex items-center gap-3 p-4 text-zoru-on-primary"
                      >
                        <ZoruAvatar>
                          {settings.avatarUrl && (
                            <ZoruAvatarImage src={settings.avatarUrl} />
                          )}
                          <ZoruAvatarFallback>
                            {settings.teamName?.charAt(0) || "S"}
                          </ZoruAvatarFallback>
                        </ZoruAvatar>
                        <div>
                          <h4>{settings.teamName}</h4>
                        </div>
                      </div>
                      <div className="flex-1 bg-zoru-surface p-4">
                        <div className="rounded-[var(--zoru-radius-sm)] bg-zoru-bg p-3 text-sm text-zoru-ink shadow-[var(--zoru-shadow-sm)]">
                          {settings.welcomeMessage}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="widget-embed">Embed code</ZoruLabel>
                <p className="text-xs text-zoru-ink-muted">
                  Copy and paste this code before the closing &lt;/body&gt; tag
                  on your website.
                </p>
                <div className="flex items-start gap-2">
                  <pre
                    id="widget-embed"
                    className="flex-1 overflow-x-auto rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3 font-mono text-xs text-zoru-ink"
                  >
                    {embedCode}
                  </pre>
                  <ZoruButton
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={handleCopy}
                    aria-label="Copy embed code"
                  >
                    <Copy />
                  </ZoruButton>
                </div>
              </div>
            </div>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <SubmitButton />
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}
