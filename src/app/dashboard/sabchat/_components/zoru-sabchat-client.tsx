"use client";

import {
  cn,
  useZoruToast,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruScrollArea,
  ZoruSkeleton,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition } from "react";
import { useSearchParams,
  useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { format,
  formatDistanceToNow } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  Users,
  } from "lucide-react";

import {
  getChatSessionsForUser,
  getFullChatSession,
  postChatMessageAction,
  } from "@/app/actions/sabchat.actions";
import type {
  WithId,
  SabChatSession,
  SabChatMessage,
  } from "@/lib/definitions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/sabchat/inbox — ZoruUI rebuild of SabChatClient.
 *
 * Three-pane workspace built entirely from Zoru primitives:
 *   1. Conversations list  (visitors / sessions list with search)
 *   2. Message thread      (chat window + composer with form action)
 *   3. (no separate contact panel for sabchat — visitor metadata is
 *      shown inline in the thread header / overflow popover)
 *
 * Server-action wiring preserved end-to-end:
 *   - getChatSessionsForUser()
 *   - getFullChatSession(sessionId)
 *   - postChatMessageAction(...)  (form action)
 *
 * Mirrors the legacy `SabChatClient` exactly in behaviour. Only the
 * visual primitives are swapped to Zoru — same data, same handlers.
 */

import * as React from "react";

const sendInitialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

/* ── skeletons ────────────────────────────────────────────────────── */

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <ZoruSkeleton className="h-full w-[320px] shrink-0" />
      <ZoruSkeleton className="h-full flex-1" />
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

interface ConversationListProps {
  conversations: WithId<SabChatSession>[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: WithId<SabChatSession>) => void;
  isLoading: boolean;
}

function ZoruConversationListPane({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
  }, 300);

  const filteredConversations = conversations.filter((convo) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      convo.visitorInfo?.email?.toLowerCase().includes(q) ||
      convo.history.some((msg) => msg.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zoru-bg">
      {/* Search bar */}
      <div className="shrink-0 border-b border-zoru-line p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <ZoruInput
            placeholder="Search by email or message..."
            className="pl-8"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ZoruScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationRowSkeleton key={i} />
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <>
            {filteredConversations.map((convo) => {
              const id = convo._id.toString();
              const lastMessage = convo.history[convo.history.length - 1];
              const selected = selectedConversationId === id;
              const visitorEmail = convo.visitorInfo?.email || "New Visitor";
              const initial = visitorEmail.charAt(0).toUpperCase() || "V";

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectConversation(convo)}
                  className={cn(
                    "mx-2 mb-1 flex w-[calc(100%-16px)] items-start gap-3 rounded-[var(--zoru-radius)] p-3 text-left transition-colors",
                    selected
                      ? "bg-zoru-surface-2 shadow-[var(--zoru-shadow-sm)]"
                      : "hover:bg-zoru-surface",
                  )}
                >
                  <ZoruAvatar>
                    <ZoruAvatarFallback>{initial}</ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate pr-2 text-zoru-ink">
                        {visitorEmail}
                      </span>
                      <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-zoru-ink-subtle">
                        {formatDistanceToNow(new Date(convo.updatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 block max-w-[220px] truncate text-xs text-zoru-ink-muted">
                      {lastMessage?.content || "No messages yet."}
                    </p>
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-zoru-ink-muted">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
              <Users className="h-5 w-5" />
            </div>
            <div>No conversations found.</div>
          </div>
        )}
      </ZoruScrollArea>
    </div>
  );
}

/* ── chat window (thread + composer) ──────────────────────────────── */

function ChatMessageBubble({
  message,
  isAgent,
}: {
  message: SabChatMessage;
  isAgent: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isAgent ? "justify-end" : "justify-start",
      )}
    >
      {!isAgent && (
        <ZoruAvatar className="h-8 w-8 self-end">
          <ZoruAvatarFallback>V</ZoruAvatarFallback>
        </ZoruAvatar>
      )}
      <div
        className={cn(
          "flex max-w-[70%] flex-col rounded-[var(--zoru-radius)] px-3 py-2 text-sm shadow-[var(--zoru-shadow-sm)]",
          isAgent
            ? "rounded-br-none bg-zoru-ink text-zoru-on-primary"
            : "rounded-bl-none bg-zoru-surface-2 text-zoru-ink",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 self-end text-[10px]",
            isAgent ? "text-zoru-on-primary/70" : "text-zoru-ink-subtle",
          )}
        >
          <p>{format(new Date(message.timestamp), "p")}</p>
        </div>
      </div>
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="icon-sm" disabled={pending} aria-label="Send">
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Send />
      )}
    </ZoruButton>
  );
}

interface ChatWindowProps {
  session: WithId<SabChatSession>;
  isLoading: boolean;
  onMessageSent: () => void;
  onBack: () => void;
}

function ZoruSabChatWindow({
  session,
  isLoading,
  onMessageSent,
  onBack,
}: ChatWindowProps) {
  const [sendState, sendFormAction] = useActionState(
    postChatMessageAction,
    sendInitialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useZoruToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sendState.error) {
      toast({
        title: "Error sending message",
        description: sendState.error,
        variant: "destructive",
      });
    }
    if (sendState.success) {
      formRef.current?.reset();
      onMessageSent();
    }
  }, [sendState, toast, onMessageSent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.history]);

  const visitorEmail = session.visitorInfo?.email || "New Visitor";
  const initial = visitorEmail.charAt(0).toUpperCase() || "V";

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Header */}
      <div className="flex h-[73px] shrink-0 items-center justify-between gap-3 border-b border-zoru-line bg-zoru-bg p-3">
        <div className="flex items-center gap-3">
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft />
          </ZoruButton>
          <ZoruAvatar>
            <ZoruAvatarFallback>{initial}</ZoruAvatarFallback>
          </ZoruAvatar>
          <div className="min-w-0">
            <p className="truncate text-zoru-ink">{visitorEmail}</p>
            {session.visitorInfo?.ip && (
              <p className="truncate font-mono text-[11px] text-zoru-ink-subtle">
                {session.visitorInfo.ip}
              </p>
            )}
          </div>
        </div>
        {session.visitorInfo?.page && (
          <ZoruBadge
            variant="outline"
            className="hidden max-w-[260px] truncate font-mono text-[11px] md:inline-flex"
            title={session.visitorInfo.page}
          >
            {session.visitorInfo.page}
          </ZoruBadge>
        )}
      </div>

      {/* Thread */}
      <ZoruScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-16">
            <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {session.history.map((msg, index) => (
              <ChatMessageBubble
                key={index}
                message={msg}
                isAgent={msg.sender === "agent"}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ZoruScrollArea>

      {/* Composer */}
      <div className="flex shrink-0 items-center border-t border-zoru-line bg-zoru-bg p-3">
        <form
          ref={formRef}
          action={sendFormAction}
          className="flex w-full items-center gap-2"
        >
          <input
            type="hidden"
            name="sessionId"
            value={session._id.toString()}
          />
          <input type="hidden" name="sender" value="agent" />
          <ZoruInput
            name="content"
            placeholder="Type your reply..."
            autoComplete="off"
            className="flex-1"
          />
          <SendButton />
        </form>
      </div>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */

export function ZoruSabChatClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sessionUser } = useProject();

  const conversationIdFromUrl = searchParams.get("conversationId");

  const [conversations, setConversations] = useState<WithId<SabChatSession>[]>(
    [],
  );
  const [selectedConversation, setSelectedConversation] =
    useState<WithId<SabChatSession> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [loadingConversation, startConversationLoadTransition] = useTransition();

  const handleSelectConversation = useCallback(
    async (conversation: WithId<SabChatSession>) => {
      startConversationLoadTransition(async () => {
        const fullConvo = await getFullChatSession(conversation._id.toString());
        setSelectedConversation(fullConvo);
        router.replace(
          `/dashboard/sabchat/inbox?conversationId=${conversation._id.toString()}`,
          { scroll: false },
        );
      });
    },
    [router],
  );

  const fetchInitialData = useCallback(() => {
    startLoadingTransition(async () => {
      const sessions = await getChatSessionsForUser();
      setConversations(sessions);

      if (conversationIdFromUrl) {
        const convo = sessions.find(
          (c: WithId<SabChatSession>) =>
            c._id.toString() === conversationIdFromUrl,
        );
        if (convo) {
          handleSelectConversation(convo);
        }
      } else if (sessions.length > 0) {
        handleSelectConversation(sessions[0]);
      }
    });
  }, [conversationIdFromUrl, handleSelectConversation]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const onMessageSent = useCallback(() => {
    if (selectedConversation) {
      handleSelectConversation(selectedConversation);
    }
  }, [selectedConversation, handleSelectConversation]);

  if (isLoading && conversations.length === 0) {
    return <ChatPageSkeleton />;
  }

  if (!sessionUser) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ZoruAlert variant="destructive" className="max-w-md">
          <AlertCircle />
          <ZoruAlertTitle>Not logged in</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please log in to use the live chat inbox.
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  return (
    <ZoruCard className="flex h-full w-full flex-col overflow-hidden p-0">
      <div className="flex flex-1 overflow-hidden">
        {/* Pane 1 — conversations list */}
        <div
          className={cn(
            "w-full shrink-0 flex-col border-r border-zoru-line md:w-[320px]",
            selectedConversation ? "hidden md:flex" : "flex",
          )}
        >
          <ZoruConversationListPane
            conversations={conversations}
            selectedConversationId={selectedConversation?._id.toString()}
            onSelectConversation={handleSelectConversation}
            isLoading={isLoading}
          />
        </div>

        {/* Pane 2 — message thread */}
        <div
          className={cn(
            "relative w-full flex-1 flex-col",
            selectedConversation ? "flex" : "hidden md:flex",
          )}
        >
          {selectedConversation ? (
            <ZoruSabChatWindow
              key={selectedConversation._id.toString()}
              session={selectedConversation}
              isLoading={loadingConversation}
              onMessageSent={onMessageSent}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center gap-4 bg-zoru-surface p-8 text-center text-zoru-ink-muted md:flex">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zoru-surface-2">
                <MessageSquare className="h-10 w-10 text-zoru-ink-subtle" />
              </div>
              <h2 className="text-xl text-zoru-ink">Select a conversation</h2>
              <p className="max-w-xs text-sm">
                Choose a chat from the list to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </ZoruCard>
  );
}
