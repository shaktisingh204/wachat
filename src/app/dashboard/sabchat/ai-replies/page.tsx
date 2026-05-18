"use client";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Bot,
  LoaderCircle,
  Save } from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/sabchat/ai-replies — AI assistant configuration.
 *
 * Same `saveSabChatSettings` server action; pass-through hidden field
 * preserves all unrelated settings keys. Visual layer fully Zoru.
 */

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
      Save AI settings
    </ZoruButton>
  );
}

export default function SabChatAiRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const settings = sessionUser?.sabChatSettings || {};
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(saveSabChatSettings, initialState);
  const { toast } = useZoruToast();

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

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>AI Replies</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>AI replies</ZoruPageTitle>
          <ZoruPageDescription>
            Configure the AI assistant for your chat.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <form action={formAction}>
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
          })}
        />

        <ZoruCard>
          <ZoruCardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <ZoruCardTitle>AI assistant configuration</ZoruCardTitle>
                <ZoruCardDescription>
                  Provide context about your business. The AI will use this
                  information, along with your FAQs, to answer visitor
                  questions automatically.
                </ZoruCardDescription>
              </div>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-6">
            <div className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
              <ZoruSwitch
                id="aiEnabled"
                name="aiEnabled"
                defaultChecked={settings.aiEnabled}
              />
              <div>
                <ZoruLabel htmlFor="aiEnabled">
                  Enable AI assistant
                </ZoruLabel>
                <p className="text-xs text-zoru-ink-muted">
                  When enabled, the assistant will reply to visitors using the
                  context below.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <ZoruLabel htmlFor="aiContext">Business context</ZoruLabel>
              <ZoruTextarea
                id="aiContext"
                name="aiContext"
                defaultValue={settings.aiContext || ""}
                className="min-h-[260px]"
                placeholder="Describe your business, services, hours, and common policies..."
              />
              <p className="text-xs text-zoru-ink-muted">
                The more detailed your context, the better the AI will perform.
              </p>
            </div>

            <div className="flex justify-end">
              <SubmitButton />
            </div>
          </ZoruCardContent>
        </ZoruCard>
      </form>
    </div>
  );
}
