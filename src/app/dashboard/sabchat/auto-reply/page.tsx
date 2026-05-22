"use client";

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
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
 * /dashboard/sabchat/auto-reply — automated welcome / away messages.
 *
 * Same `saveSabChatSettings` server action; pass-through hidden field
 * preserves all unrelated settings keys. Per-trigger blocks rendered as
 * a Zoru accordion as required by the migration plan.
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
      Save auto-reply settings
    </ZoruButton>
  );
}

export default function SabChatAutoReplyPage() {
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

  // Master switch combines welcomeEnabled + awayMessageEnabled. We keep
  // the underlying per-trigger switches authoritative for the action,
  // but visualise both with a single header switch + accordion.
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
            <ZoruBreadcrumbPage>Auto Reply</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Auto reply</ZoruPageTitle>
          <ZoruPageDescription>
            Automated messages sent to visitors based on triggers.
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
            teamName: settings.teamName,
            avatarUrl: settings.avatarUrl,
            officeHours: settings.officeHours,
            aiEnabled: settings.aiEnabled,
            aiContext: settings.aiContext,
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
                <ZoruCardTitle>Automated messages</ZoruCardTitle>
                <ZoruCardDescription>
                  Configure each trigger independently. Office hours can be
                  configured under general settings.
                </ZoruCardDescription>
              </div>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruAccordion
              type="multiple"
              defaultValue={["welcome", "away"]}
              className="w-full"
            >
              {/* Welcome message */}
              <ZoruAccordionItem value="welcome">
                <ZoruAccordionTrigger>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-zoru-ink">Welcome message</span>
                    <span className="text-xs font-normal text-zoru-ink-muted">
                      The first message a visitor sees when they start a chat.
                    </span>
                  </span>
                </ZoruAccordionTrigger>
                <ZoruAccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3">
                      <ZoruSwitch
                        id="welcomeEnabled"
                        name="welcomeEnabled"
                        defaultChecked={settings.welcomeEnabled}
                      />
                      <ZoruLabel htmlFor="welcomeEnabled">
                        Send welcome message
                      </ZoruLabel>
                    </div>
                    <ZoruTextarea
                      name="welcomeMessage"
                      defaultValue={
                        settings.welcomeMessage ||
                        "Hello! How can we help you today?"
                      }
                      placeholder="Welcome message..."
                      className="min-h-24"
                    />
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              {/* Away message */}
              <ZoruAccordionItem value="away">
                <ZoruAccordionTrigger>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-zoru-ink">Away message</span>
                    <span className="text-xs font-normal text-zoru-ink-muted">
                      Sent automatically when a visitor messages you outside
                      office hours.
                    </span>
                  </span>
                </ZoruAccordionTrigger>
                <ZoruAccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3">
                      <ZoruSwitch
                        id="awayMessageEnabled"
                        name="awayMessageEnabled"
                        defaultChecked={settings.awayMessageEnabled}
                      />
                      <ZoruLabel htmlFor="awayMessageEnabled">
                        Send away message
                      </ZoruLabel>
                    </div>
                    <ZoruTextarea
                      name="awayMessage"
                      defaultValue={
                        settings.awayMessage ||
                        "We are currently away, but we will get back to you as soon as possible."
                      }
                      placeholder="Away message..."
                      className="min-h-24"
                    />
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
            </ZoruAccordion>

            <div className="mt-6 flex justify-end">
              <SubmitButton />
            </div>
          </ZoruCardContent>
        </ZoruCard>
      </form>
    </div>
  );
}
