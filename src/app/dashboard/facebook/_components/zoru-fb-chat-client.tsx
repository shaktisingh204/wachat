"use client";

/**
 * /dashboard/facebook/messages — ZoruUI rebuild of FacebookChatClient.
 *
 * Three-pane workspace:
 *   1. Conversations list  (rebuilt inline with Zoru primitives)
 *   2. Message thread      (rebuilt inline; reuses sendFacebookMessage
 *                           server action via useActionState)
 *   3. Contact info panel  (Zoru-native, in a ZoruSheet on mobile)
 *
 * Same data, same handlers, same server-action calls — visual layer only.
 *
 * Server actions preserved end-to-end:
 *   - getFacebookChatInitialData(projectId)
 *   - getFacebookConversationMessages(conversationId, projectId)
 *   - markFacebookConversationAsRead(conversationId, projectId)
 *   - sendFacebookMessage(prevState, formData)
 *   - getSession()
 *
 * Polling preserves the legacy 5-second cadence.
 */

import * as React from "react";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useMemo,
  useRef,
  useActionState,
} from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Info,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  Search,
  Send,
  Video,
} from "lucide-react";
import type { WithId } from "mongodb";

import {
  getFacebookChatInitialData,
  getFacebookConversationMessages,
  markFacebookConversationAsRead,
  sendFacebookMessage,
} from "@/app/actions/facebook.actions";
import { getSession } from "@/app/actions/index";
import type {
  Project,
  FacebookConversation,
  FacebookMessage,
  User,
  Plan,
} from "@/lib/definitions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruScrollArea,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  ZoruSkeleton,
  useZoruToast,
  cn,
} from "@/components/zoruui";

type SessionUser =
  | (Omit<User, "password"> & { _id: string; plan?: WithId<Plan> | null })
  | null;

/* ── skeletons ─────────────────────────────────────────────────────── */

function ChatSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <ZoruSkeleton className="h-full w-full md:w-[320px] md:shrink-0" />
      <ZoruSkeleton className="hidden h-full flex-1 md:block" />
    </div>
  );
}

function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <ZoruSkeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <ZoruSkeleton className="h-4 w-3/4" />
        <ZoruSkeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/* ── conversation list pane ───────────────────────────────────────── */

function getParticipant(convo: FacebookConversation, pageId?: string) {
  // Prefer participant who is not the page itself.
  return (
    convo.participants.data.find((p) => pageId && p.id !== pageId) ||
    convo.participants.data[0]
  );
}

interface ConversationListPaneProps {
  sessionUser: SessionUser;
  pageId?: string;
  conversations: FacebookConversation[];
  selectedConversationId?: string;
  onSelect: (c: FacebookConversation) => void;
  onNewChat: () => void;
  isLoading: boolean;
}

const ConversationListPane = React.memo(function ConversationListPane({
  sessionUser,
  pageId,
  conversations,
  selectedConversationId,
  onSelect,
  onNewChat,
  isLoading,
}: ConversationListPaneProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = useMemo(() => {
    let result = conversations;
    if (filter === "unread") {
      result = result.filter((c) => (c.unread_count || 0) > 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const p = getParticipant(c, pageId);
        return (
          (p?.name || "").toLowerCase().includes(q) ||
          (c.snippet || "").toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [conversations, search, filter, pageId]);

  const unreadCount = useMemo(
    () => conversations.filter((c) => (c.unread_count || 0) > 0).length,
    [conversations],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zoru-bg">
      {/* Header: session user + new-chat */}
      <div className="flex shrink-0 items-center justify-between border-b border-zoru-line p-3">
        {sessionUser ? (
          <div className="flex min-w-0 items-center gap-3">
            <ZoruAvatar>
              <ZoruAvatarImage
                src={`https://i.pravatar.cc/150?u=${sessionUser.email}`}
                alt={sessionUser.name}
              />
              <ZoruAvatarFallback>
                {sessionUser.name.charAt(0)}
              </ZoruAvatarFallback>
            </ZoruAvatar>
            <p className="truncate text-zoru-ink">{sessionUser.name}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ZoruSkeleton className="h-10 w-10 rounded-full" />
            <ZoruSkeleton className="h-4 w-24" />
          </div>
        )}
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <MessageSquarePlus />
        </ZoruButton>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-zoru-line p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <ZoruInput
            placeholder="Search conversations…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* All / Unread filter */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zoru-line px-3 py-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] transition-colors",
            filter === "all"
              ? "bg-zoru-ink text-zoru-on-primary"
              : "bg-zoru-surface-2 text-zoru-ink-muted hover:bg-zoru-surface",
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] transition-colors",
            filter === "unread"
              ? "bg-zoru-ink text-zoru-on-primary"
              : "bg-zoru-surface-2 text-zoru-ink-muted hover:bg-zoru-surface",
          )}
        >
          Unread{unreadCount > 0 && ` (${unreadCount})`}
        </button>
      </div>

      <ZoruScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationRowSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((convo) => {
            const participant = getParticipant(convo, pageId);
            const selected = selectedConversationId === convo.id;
            const unread = convo.unread_count || 0;
            return (
              <button
                key={convo.id}
                type="button"
                onClick={() => onSelect(convo)}
                className={cn(
                  "mx-2 mb-1 flex w-[calc(100%-16px)] items-start gap-3 rounded-[var(--zoru-radius)] p-3 text-left transition-colors",
                  selected
                    ? "bg-zoru-surface-2 shadow-[var(--zoru-shadow-sm)]"
                    : "hover:bg-zoru-surface",
                )}
              >
                <ZoruAvatar>
                  <ZoruAvatarImage
                    src={`https://graph.facebook.com/${participant?.id}/picture`}
                    alt={participant?.name || "User"}
                  />
                  <ZoruAvatarFallback>
                    {(participant?.name || "U").charAt(0).toUpperCase()}
                  </ZoruAvatarFallback>
                </ZoruAvatar>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "truncate",
                        unread > 0 ? "text-zoru-ink" : "text-zoru-ink-muted",
                      )}
                    >
                      {participant?.name || "Unknown user"}
                    </span>
                    <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-zoru-ink-subtle">
                      {format(new Date(convo.updated_time), "p")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="block max-w-[180px] truncate text-xs text-zoru-ink-muted">
                      {convo.snippet || "—"}
                    </span>
                    {unread > 0 && (
                      <ZoruBadge className="ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px]">
                        {unread}
                      </ZoruBadge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-zoru-ink-muted">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>No conversations found.</div>
          </div>
        )}
      </ZoruScrollArea>
    </div>
  );
});

/* ── chat thread pane ─────────────────────────────────────────────── */

const sendInitialState: { success?: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function MessageInputSubmit() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton
      type="submit"
      size="icon"
      disabled={pending}
      aria-label="Send message"
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
    </ZoruButton>
  );
}

interface MessageInputProps {
  projectId: string;
  recipientId: string;
  disabled?: boolean;
  onMessageSent: () => void;
}

function MessageInput({
  projectId,
  recipientId,
  disabled,
  onMessageSent,
}: MessageInputProps) {
  const [state, formAction] = useActionState(
    sendFacebookMessage,
    sendInitialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.error) {
      toast({
        title: "Error sending message",
        description: state.error,
        variant: "destructive",
      });
    }
    if (state.success) {
      formRef.current?.reset();
      onMessageSent();
    }
  }, [state, toast, onMessageSent]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex w-full items-center gap-2"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="recipientId" value={recipientId} />
      <ZoruInput
        name="messageText"
        placeholder={
          disabled
            ? "You can no longer reply to this conversation."
            : "Type a message…"
        }
        autoComplete="off"
        className="flex-1"
        disabled={disabled}
      />
      <MessageInputSubmit />
    </form>
  );
}

interface ChatMessageBubbleProps {
  message: FacebookMessage;
  pageId: string;
}

const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  pageId,
}: ChatMessageBubbleProps) {
  const isOutgoing = message.from.id === pageId;
  const participant = isOutgoing
    ? { name: "You", id: pageId }
    : message.from;

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOutgoing ? "justify-end" : "justify-start",
      )}
    >
      {!isOutgoing && (
        <ZoruAvatar className="h-8 w-8 self-end">
          <ZoruAvatarImage
            src={`https://graph.facebook.com/${participant.id}/picture`}
            alt={participant.name}
          />
          <ZoruAvatarFallback>
            {participant.name.charAt(0).toUpperCase()}
          </ZoruAvatarFallback>
        </ZoruAvatar>
      )}
      <div
        className={cn(
          "flex max-w-[70%] flex-col rounded-[var(--zoru-radius)] px-3 py-2 text-sm shadow-[var(--zoru-shadow-sm)]",
          isOutgoing
            ? "rounded-br-none bg-zoru-ink text-zoru-on-primary"
            : "rounded-bl-none bg-zoru-surface text-zoru-ink",
        )}
      >
        <p className="whitespace-pre-wrap">{message.message}</p>
        <span
          className={cn(
            "mt-1 self-end text-[10.5px]",
            isOutgoing ? "text-zoru-on-primary/70" : "text-zoru-ink-muted",
          )}
        >
          {format(new Date(message.created_time), "p")}
        </span>
      </div>
    </div>
  );
});

interface ChatThreadPaneProps {
  project: WithId<Project>;
  conversation: FacebookConversation;
  messages: FacebookMessage[];
  isLoading: boolean;
  onBack: () => void;
  onShowInfo: () => void;
  onMessageSent: () => void;
}

function ChatThreadPane({
  project,
  conversation,
  messages,
  isLoading,
  onBack,
  onShowInfo,
  onMessageSent,
}: ChatThreadPaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageId = project.facebookPageId || "";
  const participant = conversation.participants.data.find(
    (p) => p.id !== pageId,
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[73px] shrink-0 items-center justify-between gap-3 border-b border-zoru-line bg-zoru-bg p-3">
        <div className="flex min-w-0 items-center gap-3">
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft />
          </ZoruButton>
          <ZoruAvatar>
            <ZoruAvatarImage
              src={`https://graph.facebook.com/${participant?.id}/picture`}
              alt={participant?.name || "User"}
            />
            <ZoruAvatarFallback>
              {(participant?.name || "U").charAt(0).toUpperCase()}
            </ZoruAvatarFallback>
          </ZoruAvatar>
          <div className="min-w-0">
            <p className="truncate text-zoru-ink">{participant?.name}</p>
            <p className="text-xs text-zoru-ink-muted">online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label="Voice call"
          >
            <Phone />
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label="Video call"
          >
            <Video />
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            onClick={onShowInfo}
            aria-label="Conversation info"
          >
            <Info />
          </ZoruButton>
        </div>
      </div>

      {/* Messages scroll area */}
      <ZoruScrollArea className="flex-1 bg-zoru-surface">
        <div className="space-y-4 p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-zoru-ink-muted">
              <MessageCircle className="h-6 w-6" />
              <span>No messages yet — say hello.</span>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} pageId={pageId} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ZoruScrollArea>

      {/* Composer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-zoru-line bg-zoru-bg p-3">
        {participant && pageId ? (
          <MessageInput
            projectId={project._id.toString()}
            recipientId={participant.id}
            disabled={!conversation.can_reply}
            onMessageSent={onMessageSent}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ── contact info side panel (Sheet on mobile, fixed on desktop) ─── */

interface ContactInfoPanelProps {
  conversation: FacebookConversation | null;
  pageId?: string;
}

function ContactInfoPanelBody({
  conversation,
  pageId,
}: ContactInfoPanelProps) {
  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-zoru-ink-muted">
        <Info className="h-5 w-5" />
        <span>Select a conversation to see participant details.</span>
      </div>
    );
  }
  const participant = getParticipant(conversation, pageId);
  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <div className="flex flex-col items-center gap-2">
        <ZoruAvatar className="h-16 w-16">
          <ZoruAvatarImage
            src={`https://graph.facebook.com/${participant?.id}/picture`}
            alt={participant?.name || "User"}
          />
          <ZoruAvatarFallback>
            {(participant?.name || "U").charAt(0).toUpperCase()}
          </ZoruAvatarFallback>
        </ZoruAvatar>
        <p className="text-[15px] text-zoru-ink">
          {participant?.name || "Unknown user"}
        </p>
        {participant?.email && (
          <p className="text-xs text-zoru-ink-muted">{participant.email}</p>
        )}
      </div>

      <div className="space-y-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zoru-ink-muted">Last activity</span>
          <span className="text-zoru-ink">
            {formatDistanceToNow(new Date(conversation.updated_time), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zoru-ink-muted">Unread</span>
          <span className="text-zoru-ink">{conversation.unread_count || 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zoru-ink-muted">Can reply</span>
          <span className="text-zoru-ink">
            {conversation.can_reply ? "Yes" : "No (window expired)"}
          </span>
        </div>
        {conversation.status && (
          <div className="flex items-center justify-between">
            <span className="text-zoru-ink-muted">Status</span>
            <span className="text-zoru-ink">{conversation.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main client ──────────────────────────────────────────────────── */

export function ZoruFacebookChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdFromUrl = searchParams.get("conversationId");

  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser>(null);
  const [conversations, setConversations] = useState<FacebookConversation[]>(
    [],
  );
  const [selectedConversation, setSelectedConversation] =
    useState<FacebookConversation | null>(null);
  const [messages, setMessages] = useState<FacebookMessage[]>([]);

  const [isLoading, startLoadingTransition] = useTransition();
  const [loadingConversation, startConversationLoadTransition] = useTransition();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (conversation: FacebookConversation, pid?: string) => {
      const currentProjectId = pid || projectId;
      if (!currentProjectId) return;

      setSelectedConversation(conversation);
      router.push(
        `/dashboard/facebook/messages?conversationId=${conversation.id}`,
        { scroll: false },
      );

      // Optimistically clear unread count
      if (conversation.unread_count > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversation.id ? { ...c, unread_count: 0 } : c,
          ),
        );
        await markFacebookConversationAsRead(conversation.id, currentProjectId);
      }

      startConversationLoadTransition(async () => {
        const { messages: fetched, error } =
          await getFacebookConversationMessages(
            conversation.id,
            currentProjectId,
          );
        if (error) {
          console.error(error);
          setMessages([]);
        } else {
          setMessages(fetched || []);
        }
      });
    },
    [projectId, router],
  );

  const fetchInitialData = useCallback(
    (pid: string) => {
      startLoadingTransition(async () => {
        const [initialData, sessionData] = await Promise.all([
          getFacebookChatInitialData(pid),
          getSession(),
        ]);
        const {
          project: projectData,
          conversations: convosData,
          error,
        } = initialData;

        if (error) {
          if (error.includes("permission") || error.includes("(#200)")) {
            setPermissionError(error);
          } else {
            console.error(error);
          }
          setProject(projectData);
          return;
        }
        setProject(projectData);
        setConversations(convosData);
        setSessionUser(sessionData?.user || null);

        if (conversationIdFromUrl) {
          const convo = convosData.find(
            (c) => c.id === conversationIdFromUrl,
          );
          if (convo) {
            handleSelect(convo, pid);
          }
        } else {
          setSelectedConversation(null);
          setMessages([]);
        }
      });
    },
    [conversationIdFromUrl, handleSelect],
  );

  // Read project id from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("activeProjectId");
    setProjectId(stored);
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchInitialData(projectId);
    } else {
      setProject(null);
      setConversations([]);
      setMessages([]);
      setSelectedConversation(null);
    }
  }, [projectId, fetchInitialData]);

  // Polling — every 5s for the active conversation
  useEffect(() => {
    if (!selectedConversation || !projectId) return;
    const interval = setInterval(() => {
      getFacebookConversationMessages(selectedConversation.id, projectId).then(
        ({ messages: newMessages }) => {
          setMessages((prev) => {
            if (newMessages && newMessages.length > (prev?.length || 0)) {
              return newMessages;
            }
            return prev;
          });
        },
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation, projectId]);

  const onMessageSent = useCallback(async () => {
    if (selectedConversation && projectId) {
      const { messages: fetched } = await getFacebookConversationMessages(
        selectedConversation.id,
        projectId,
      );
      setMessages(fetched || []);
    }
  }, [selectedConversation, projectId]);

  if (isLoading && !project) {
    return <ChatSkeleton />;
  }

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ZoruAlert variant="destructive" className="max-w-md">
          <AlertCircle />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please select a project from the main dashboard to use the Facebook
            inbox.
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  return (
    <>
      {/* New-chat info dialog */}
      <ZoruDialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Start a conversation</ZoruDialogTitle>
            <ZoruDialogDescription>
              On Facebook Messenger, you can only reply to users who have
              messaged your page first. Use the search bar to find an existing
              conversation.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton onClick={() => setShowInfoDialog(false)}>OK</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Permission error dialog */}
      <ZoruDialog
        open={!!permissionError}
        onOpenChange={(o) => !o && setPermissionError(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Permission error</ZoruDialogTitle>
            <ZoruDialogDescription>
              {permissionError ||
                "Your Facebook access token may have expired or is missing the required permissions."}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setPermissionError(null)}
            >
              Dismiss
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                setPermissionError(null);
                router.push("/dashboard/facebook/setup");
              }}
            >
              Reconnect
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Mobile contact info sheet */}
      <ZoruSheet open={showInfoSheet} onOpenChange={setShowInfoSheet}>
        <ZoruSheetContent side="right" className="w-full sm:max-w-md p-0">
          <ZoruSheetHeader className="border-b border-zoru-line p-5">
            <ZoruSheetTitle>Contact info</ZoruSheetTitle>
            <ZoruSheetDescription>
              Details for the selected conversation.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          <ContactInfoPanelBody
            conversation={selectedConversation}
            pageId={project?.facebookPageId}
          />
        </ZoruSheetContent>
      </ZoruSheet>

      {/* Three-pane shell */}
      <div className="flex h-full overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg">
        {/* List */}
        <div
          className={cn(
            "w-full flex-shrink-0 flex-col border-r border-zoru-line md:w-[320px]",
            selectedConversation ? "hidden md:flex" : "flex",
          )}
        >
          <ConversationListPane
            sessionUser={sessionUser}
            pageId={project?.facebookPageId}
            conversations={conversations}
            selectedConversationId={selectedConversation?.id}
            onSelect={handleSelect}
            onNewChat={() => setShowInfoDialog(true)}
            isLoading={isLoading}
          />
        </div>

        {/* Thread */}
        <div
          className={cn(
            "w-full flex-1 flex-col",
            selectedConversation ? "flex" : "hidden md:flex",
          )}
        >
          {selectedConversation && project ? (
            <ChatThreadPane
              key={selectedConversation.id}
              project={project}
              conversation={selectedConversation}
              messages={messages}
              isLoading={loadingConversation}
              onBack={() => setSelectedConversation(null)}
              onShowInfo={() => setShowInfoSheet(true)}
              onMessageSent={onMessageSent}
            />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center gap-4 p-8 text-center text-zoru-ink-muted md:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-zoru-ink">Select a conversation</h2>
                <p className="mt-1 text-sm">
                  Choose a conversation from the list to start messaging.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contact info — desktop fixed panel */}
        <div className="hidden w-[300px] shrink-0 flex-col border-l border-zoru-line lg:flex">
          <ContactInfoPanelBody
            conversation={selectedConversation}
            pageId={project?.facebookPageId}
          />
        </div>
      </div>
    </>
  );
}
