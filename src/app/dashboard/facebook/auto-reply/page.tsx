"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Card, Input, Label, RadioGroup, RadioGroupItem, Separator, Skeleton, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Bot,
  Loader2,
  MessageSquareHeart,
  MessageSquareReply,
  Plus,
  Save,
  ShieldX,
  Trash2,
  } from "lucide-react";

import { handleUpdateFacebookAutomationSettings } from "@/app/actions/facebook.actions";
import { useProject } from "@/context/project-context";
import type {
  FacebookCommentAutoReplySettings,
  FacebookWelcomeMessageSettings,
  Project,
  WithId,
  } from "@/lib/definitions";

/**
 * /dashboard/facebook/auto-reply — ZoruUI rebuild.
 *
 * Two automation surfaces (Comments + Messenger Welcome) live on one page,
 * each gated by a master `ZoruSwitch` and bundled inside `ZoruAccordion`
 * sections — replacing the legacy Tabs UI. No clay, no @/components/ui/*,
 * no react-icons, no wabasimplify visual imports.
 *
 * Same server-action wiring as the legacy page:
 *   - handleUpdateFacebookAutomationSettings(prevState, formData)
 *
 * Same FormData payload contract:
 *   projectId, automationType ('comment' | 'welcome'),
 *   enabled, replyMode, staticReplyText, aiReplyPrompt,
 *   moderationEnabled, moderationPrompt, message, quickReplies (JSON)
 */

import * as React from "react";

import {
  FbBreadcrumb,
  FbHeader,
  FbNoProject,
} from "../_components/zoru-fb-page-shell";

const initialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="mt-6 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      {children}
    </Button>
  );
}

/* ── Comment automation form ─────────────────────────────────────── */

function CommentAutomationForm({
  project,
  settings,
}: {
  project: WithId<Project>;
  settings?: FacebookCommentAutoReplySettings;
}) {
  const [state, formAction] = useActionState(
    handleUpdateFacebookAutomationSettings,
    initialState,
  );
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(settings?.enabled ?? false);
  const [replyMode, setReplyMode] = useState<"static" | "ai">(
    settings?.replyMode ?? "static",
  );
  const [moderationEnabled, setModerationEnabled] = useState<boolean>(
    settings?.moderationEnabled ?? false,
  );

  useEffect(() => {
    if (state.success) {
      toast({
        title: "Settings saved",
        description: "Comment automation has been updated.",
        variant: "success",
      });
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <input type="hidden" name="automationType" value="comment" />
      {/* Switches as hidden values to ensure they post even when toggled off */}
      <input type="hidden" name="enabled" value={enabled ? "on" : ""} />
      <input
        type="hidden"
        name="moderationEnabled"
        value={moderationEnabled ? "on" : ""}
      />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[var(--st-text)]">
              <MessageSquareReply className="h-4 w-4" />
              <h2 className="text-[14px]">Comment automation</h2>
            </div>
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
              Master switch for comment replies and AI moderation. Same payload
              as the legacy automation form — only the UI changed.
            </p>
          </div>
          <Switch
            id="comment-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable comment automation"
          />
        </div>

        <Separator className="my-5" />

        <Accordion type="multiple" defaultValue={["replies"]}>
          <AccordionItem value="replies">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4" /> Replies
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <RadioGroup
                  name="replyMode"
                  value={replyMode}
                  onValueChange={(v) => setReplyMode(v as "static" | "ai")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="static" id="mode-static" />
                    <Label htmlFor="mode-static">Static reply</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ai" id="mode-ai" />
                    <Label htmlFor="mode-ai">AI-generated reply</Label>
                  </div>
                </RadioGroup>

                {replyMode === "static" ? (
                  <div className="space-y-2">
                    <Label htmlFor="staticReplyText">
                      Static reply text
                    </Label>
                    <Textarea
                      id="staticReplyText"
                      name="staticReplyText"
                      placeholder="Thanks for your comment! We'll get back to you shortly."
                      defaultValue={settings?.staticReplyText ?? ""}
                      className="min-h-32"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="aiReplyPrompt">AI reply prompt</Label>
                    <Textarea
                      id="aiReplyPrompt"
                      name="aiReplyPrompt"
                      placeholder="You are a friendly community manager. Acknowledge the user's comment and tell them you appreciate their feedback. Keep it brief and positive."
                      defaultValue={settings?.aiReplyPrompt ?? ""}
                      className="min-h-32"
                    />
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                      Provide instructions for the AI on how to generate
                      replies.
                    </p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="moderation">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <ShieldX className="h-4 w-4" /> AI moderation
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="moderationEnabled">
                      Enable AI moderation
                    </Label>
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                      Automatically delete comments that violate your rules.
                    </p>
                  </div>
                  <Switch
                    id="moderationEnabled"
                    checked={moderationEnabled}
                    onCheckedChange={setModerationEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moderationPrompt">
                    Moderation prompt
                  </Label>
                  <Textarea
                    id="moderationPrompt"
                    name="moderationPrompt"
                    placeholder="Delete any comments that contain profanity, hate speech, or personal attacks."
                    defaultValue={settings?.moderationPrompt ?? ""}
                    className="min-h-32"
                  />
                  <p className="text-[12px] text-[var(--st-text-secondary)]">
                    Define the rules for the AI to follow. If the AI determines
                    a comment violates these rules, it will be deleted.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-5 flex justify-end">
          <SubmitButton>Save comment settings</SubmitButton>
        </div>
      </Card>
    </form>
  );
}

/* ── Messenger welcome form ──────────────────────────────────────── */

function MessengerWelcomeForm({
  project,
  settings,
}: {
  project: WithId<Project>;
  settings?: FacebookWelcomeMessageSettings;
}) {
  const [state, formAction] = useActionState(
    handleUpdateFacebookAutomationSettings,
    initialState,
  );
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(settings?.enabled ?? false);
  const [quickReplies, setQuickReplies] = useState<
    { title: string; payload: string }[]
  >(settings?.quickReplies ?? []);

  useEffect(() => {
    if (state.success) {
      toast({
        title: "Settings saved",
        description: "Welcome message has been updated.",
        variant: "success",
      });
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handleAddReply = () => {
    if (quickReplies.length < 13) {
      setQuickReplies([...quickReplies, { title: "", payload: "" }]);
    } else {
      toast({
        title: "Limit reached",
        description: "You can add a maximum of 13 quick replies.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveReply = (index: number) => {
    setQuickReplies(quickReplies.filter((_, i) => i !== index));
  };

  const handleReplyChange = (
    index: number,
    field: "title" | "payload",
    value: string,
  ) => {
    const next = [...quickReplies];
    next[index] = { ...next[index], [field]: value };
    setQuickReplies(next);
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <input type="hidden" name="automationType" value="welcome" />
      <input
        type="hidden"
        name="quickReplies"
        value={JSON.stringify(quickReplies)}
      />
      <input type="hidden" name="enabled" value={enabled ? "on" : ""} />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[var(--st-text)]">
              <MessageSquareHeart className="h-4 w-4" />
              <h2 className="text-[14px]">Messenger welcome message</h2>
            </div>
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
              Automatically sent the first time a user messages your page.
            </p>
          </div>
          <Switch
            id="welcome-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable welcome message"
          />
        </div>

        <Separator className="my-5" />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">Welcome message text</Label>
            <Textarea
              id="welcome-message"
              name="message"
              placeholder="Welcome to our page! How can we help you today?"
              defaultValue={settings?.message ?? ""}
              className="min-h-32"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Quick replies (optional)</Label>
            <p className="text-[12px] text-[var(--st-text-secondary)]">
              Add up to 13 buttons to guide users after the welcome message.
            </p>
            <div className="space-y-3 pt-1">
              {quickReplies.map((reply, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Button title (max 20 chars)"
                    value={reply.title}
                    onChange={(e) =>
                      handleReplyChange(index, "title", e.target.value)
                    }
                    maxLength={20}
                  />
                  <Input
                    placeholder="Payload"
                    value={reply.payload}
                    onChange={(e) =>
                      handleReplyChange(index, "payload", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveReply(index)}
                    aria-label="Remove quick reply"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {quickReplies.length < 13 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleAddReply}
              >
                <Plus /> Add quick reply
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <SubmitButton>Save welcome message</SubmitButton>
        </div>
      </Card>
    </form>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function FacebookAutoReplyPage() {
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <FbBreadcrumb page="Auto-reply" />
      <FbHeader
        title="Facebook automation"
        description="Manage automations for Page comments and Messenger conversations."
      />

      {!activeProject ? (
        <FbNoProject />
      ) : (
        <div className="mt-6 space-y-6">
          <CommentAutomationForm
            project={activeProject}
            settings={activeProject.facebookCommentAutoReply}
          />
          <MessengerWelcomeForm
            project={activeProject}
            settings={activeProject.facebookWelcomeMessage}
          />
        </div>
      )}
    </div>
  );
}
