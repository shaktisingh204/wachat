"use client";

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Button,
  Card,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Separator,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
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
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="mt-6 space-y-4">
        <ZoruSkeleton className="h-16 w-full" />
        <ZoruSkeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      {children}
    </ZoruButton>
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
  const { toast } = useZoruToast();
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

      <ZoruCard className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zoru-ink">
              <MessageSquareReply className="h-4 w-4" />
              <h2 className="text-[14px]">Comment automation</h2>
            </div>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Master switch for comment replies and AI moderation. Same payload
              as the legacy automation form — only the UI changed.
            </p>
          </div>
          <ZoruSwitch
            id="comment-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable comment automation"
          />
        </div>

        <ZoruSeparator className="my-5" />

        <ZoruAccordion type="multiple" defaultValue={["replies"]}>
          <ZoruAccordionItem value="replies">
            <ZoruAccordionTrigger>
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4" /> Replies
              </span>
            </ZoruAccordionTrigger>
            <ZoruAccordionContent>
              <div className="space-y-4 pt-2">
                <ZoruRadioGroup
                  name="replyMode"
                  value={replyMode}
                  onValueChange={(v) => setReplyMode(v as "static" | "ai")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <ZoruRadioGroupItem value="static" id="mode-static" />
                    <ZoruLabel htmlFor="mode-static">Static reply</ZoruLabel>
                  </div>
                  <div className="flex items-center gap-2">
                    <ZoruRadioGroupItem value="ai" id="mode-ai" />
                    <ZoruLabel htmlFor="mode-ai">AI-generated reply</ZoruLabel>
                  </div>
                </ZoruRadioGroup>

                {replyMode === "static" ? (
                  <div className="space-y-2">
                    <ZoruLabel htmlFor="staticReplyText">
                      Static reply text
                    </ZoruLabel>
                    <ZoruTextarea
                      id="staticReplyText"
                      name="staticReplyText"
                      placeholder="Thanks for your comment! We'll get back to you shortly."
                      defaultValue={settings?.staticReplyText ?? ""}
                      className="min-h-32"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ZoruLabel htmlFor="aiReplyPrompt">AI reply prompt</ZoruLabel>
                    <ZoruTextarea
                      id="aiReplyPrompt"
                      name="aiReplyPrompt"
                      placeholder="You are a friendly community manager. Acknowledge the user's comment and tell them you appreciate their feedback. Keep it brief and positive."
                      defaultValue={settings?.aiReplyPrompt ?? ""}
                      className="min-h-32"
                    />
                    <p className="text-[12px] text-zoru-ink-muted">
                      Provide instructions for the AI on how to generate
                      replies.
                    </p>
                  </div>
                )}
              </div>
            </ZoruAccordionContent>
          </ZoruAccordionItem>

          <ZoruAccordionItem value="moderation">
            <ZoruAccordionTrigger>
              <span className="flex items-center gap-2">
                <ShieldX className="h-4 w-4" /> AI moderation
              </span>
            </ZoruAccordionTrigger>
            <ZoruAccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <ZoruLabel htmlFor="moderationEnabled">
                      Enable AI moderation
                    </ZoruLabel>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                      Automatically delete comments that violate your rules.
                    </p>
                  </div>
                  <ZoruSwitch
                    id="moderationEnabled"
                    checked={moderationEnabled}
                    onCheckedChange={setModerationEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <ZoruLabel htmlFor="moderationPrompt">
                    Moderation prompt
                  </ZoruLabel>
                  <ZoruTextarea
                    id="moderationPrompt"
                    name="moderationPrompt"
                    placeholder="Delete any comments that contain profanity, hate speech, or personal attacks."
                    defaultValue={settings?.moderationPrompt ?? ""}
                    className="min-h-32"
                  />
                  <p className="text-[12px] text-zoru-ink-muted">
                    Define the rules for the AI to follow. If the AI determines
                    a comment violates these rules, it will be deleted.
                  </p>
                </div>
              </div>
            </ZoruAccordionContent>
          </ZoruAccordionItem>
        </ZoruAccordion>

        <div className="mt-5 flex justify-end">
          <SubmitButton>Save comment settings</SubmitButton>
        </div>
      </ZoruCard>
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
  const { toast } = useZoruToast();
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

      <ZoruCard className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zoru-ink">
              <MessageSquareHeart className="h-4 w-4" />
              <h2 className="text-[14px]">Messenger welcome message</h2>
            </div>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Automatically sent the first time a user messages your page.
            </p>
          </div>
          <ZoruSwitch
            id="welcome-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable welcome message"
          />
        </div>

        <ZoruSeparator className="my-5" />

        <div className="space-y-4">
          <div className="space-y-2">
            <ZoruLabel htmlFor="welcome-message">Welcome message text</ZoruLabel>
            <ZoruTextarea
              id="welcome-message"
              name="message"
              placeholder="Welcome to our page! How can we help you today?"
              defaultValue={settings?.message ?? ""}
              className="min-h-32"
            />
          </div>

          <ZoruSeparator />

          <div className="space-y-2">
            <ZoruLabel>Quick replies (optional)</ZoruLabel>
            <p className="text-[12px] text-zoru-ink-muted">
              Add up to 13 buttons to guide users after the welcome message.
            </p>
            <div className="space-y-3 pt-1">
              {quickReplies.map((reply, index) => (
                <div key={index} className="flex items-center gap-2">
                  <ZoruInput
                    placeholder="Button title (max 20 chars)"
                    value={reply.title}
                    onChange={(e) =>
                      handleReplyChange(index, "title", e.target.value)
                    }
                    maxLength={20}
                  />
                  <ZoruInput
                    placeholder="Payload"
                    value={reply.payload}
                    onChange={(e) =>
                      handleReplyChange(index, "payload", e.target.value)
                    }
                  />
                  <ZoruButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveReply(index)}
                    aria-label="Remove quick reply"
                  >
                    <Trash2 />
                  </ZoruButton>
                </div>
              ))}
            </div>
            {quickReplies.length < 13 && (
              <ZoruButton
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleAddReply}
              >
                <Plus /> Add quick reply
              </ZoruButton>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <SubmitButton>Save welcome message</SubmitButton>
        </div>
      </ZoruCard>
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
