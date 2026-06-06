"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Switch,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Bot, Save } from "lucide-react";

import { saveSabChatSettings } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/sabchat/auto-reply, automated welcome / away messages.
 *
 * Same `saveSabChatSettings` server action; a pass-through hidden field
 * preserves all unrelated settings keys. Per-trigger blocks render as a 20ui
 * accordion as required by the migration plan.
 */

const initialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
      Save auto-reply settings
    </Button>
  );
}

export default function SabChatAutoReplyPage() {
  const { sessionUser, reloadProject } = useProject();
  const settings = sessionUser?.sabChatSettings || {};
  // @ts-expect-error - sabchat settings action signature
  const [state, formAction] = useActionState(saveSabChatSettings, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) {
      toast.success({ title: "Saved", description: state.message });
      reloadProject();
    }
    if (state.error) {
      toast.error({ title: "Error", description: state.error });
    }
  }, [state, toast, reloadProject]);

  // The two per-trigger switches stay authoritative for the action; both
  // triggers are visualised in a single accordion.
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Auto Reply</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Auto reply</PageTitle>
          <PageDescription>
            Automated messages sent to visitors based on triggers.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <form action={formAction}>
        <input type="hidden" name="_form" value="auto-reply" />
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Automated messages</CardTitle>
                <CardDescription>
                  Configure each trigger independently. Office hours can be
                  configured under general settings.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <Accordion
              type="multiple"
              defaultValue={["welcome", "away"]}
              className="w-full"
            >
              {/* Welcome message */}
              <AccordionItem value="welcome">
                <AccordionTrigger>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-[var(--st-text)]">Welcome message</span>
                    <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                      The first message a visitor sees when they start a chat.
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                      <Switch
                        id="welcomeEnabled"
                        name="welcomeEnabled"
                        defaultChecked={settings.welcomeEnabled}
                        label="Send welcome message"
                      />
                    </div>
                    <Field label="Welcome message text">
                      <Textarea
                        name="welcomeMessage"
                        defaultValue={
                          settings.welcomeMessage ||
                          "Hello! How can we help you today?"
                        }
                        placeholder="Welcome message..."
                        className="min-h-24"
                      />
                    </Field>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Away message */}
              <AccordionItem value="away">
                <AccordionTrigger>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-[var(--st-text)]">Away message</span>
                    <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                      Sent automatically when a visitor messages you outside
                      office hours.
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                      <Switch
                        id="awayMessageEnabled"
                        name="awayMessageEnabled"
                        defaultChecked={settings.awayMessageEnabled}
                        label="Send away message"
                      />
                    </div>
                    <Field label="Away message text">
                      <Textarea
                        name="awayMessage"
                        defaultValue={
                          settings.awayMessage ||
                          "We are currently away, but we will get back to you as soon as possible."
                        }
                        placeholder="Away message..."
                        className="min-h-24"
                      />
                    </Field>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 flex justify-end">
              <SubmitButton />
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
