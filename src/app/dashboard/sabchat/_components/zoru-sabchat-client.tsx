"use client";

import {
  cn,
  useToast,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  IconButton,
  Card,
  Input,
  Textarea,
  ScrollArea,
  Skeleton,
  Spinner,
  Switch,
  Checkbox,
  EmptyState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/sabcrm/20ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Smile,
  Zap,
  MoreVertical,
  Clock,
  CheckCircle2,
  Tag,
  Languages,
  EyeOff,
  Bold,
  Italic,
  List,
  MapPin,
  Laptop,
  Globe,
  Star,
  Trash2,
  Filter,
  Plus,
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

const sendInitialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

/* skeletons */

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <Skeleton className="h-full w-[320px] shrink-0" />
      <Skeleton className="h-full flex-1" />
      <Skeleton className="h-full w-[280px] shrink-0 hidden lg:block" />
    </div>
  );
}

function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton circle width={40} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/* conversation list pane */

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
  const [filterTab, setFilterTab] = useState<"mine" | "unassigned" | "all">("all");
  const [selectedBulk, setSelectedBulk] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
  }, 300);

  const filteredConversations = conversations.filter((convo) => {
    // Advanced filtering mock
    if (filterTab === "mine") return true; // mock
    if (filterTab === "unassigned") return convo.status === "open"; // mock

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      convo.visitorInfo?.email?.toLowerCase().includes(q) ||
      convo.history.some((msg) => msg.content.toLowerCase().includes(q))
    );
  });

  const toggleBulk = (id: string) => {
    setSelectedBulk((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--st-bg)]">
      {/* Search and Filter */}
      <div className="shrink-0 border-b border-[var(--st-border)] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
            Inbox
            <Badge variant="secondary">{filteredConversations.length}</Badge>
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Filter conversations" icon={Filter} size="sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setFilterTab("all")}>
                All conversations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterTab("mine")}>
                Assigned to me
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterTab("unassigned")}>
                Unassigned
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsBulkMode(!isBulkMode)}>
                {isBulkMode ? "Exit bulk mode" : "Bulk actions"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Input
          aria-label="Search conversations by email or message"
          placeholder="Search by email or message..."
          inputSize="sm"
          iconLeft={Search}
          onChange={(e) => handleSearch(e.target.value)}
        />

        {isBulkMode && (
          <div className="flex items-center justify-between bg-[var(--st-bg-muted)] p-2 rounded-[var(--st-radius-sm)]">
            <span className="text-xs font-medium text-[var(--st-text)]">
              {selectedBulk.length} selected
            </span>
            <div className="flex gap-1">
              <IconButton label="Resolve selected" icon={CheckCircle2} variant="outline" size="sm" />
              <IconButton label="Delete selected" icon={Trash2} variant="outline" size="sm" />
            </div>
          </div>
        )}
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationRowSkeleton key={i} />
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="pt-2">
            {filteredConversations.map((convo) => {
              const id = convo._id.toString();
              const lastMessage = convo.history[convo.history.length - 1];
              const selected = selectedConversationId === id;
              const visitorEmail = convo.visitorInfo?.email || "New Visitor";
              const initial = visitorEmail.charAt(0).toUpperCase() || "V";
              const isUnread = true; // Mock unread state

              return (
                <div key={id} className="relative group mx-2 mb-1">
                  {isBulkMode && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                      <Checkbox
                        aria-label={`Select conversation with ${visitorEmail}`}
                        checked={selectedBulk.includes(id)}
                        onChange={() => toggleBulk(id)}
                      />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    block
                    onClick={() => !isBulkMode && onSelectConversation(convo)}
                    className={cn(
                      "!h-auto !items-start !justify-start !p-3 text-left transition-colors [&_.u-btn__label]:w-full [&_.u-btn__label]:overflow-visible",
                      isBulkMode && "!pl-8",
                      selected
                        ? "!bg-[var(--st-bg-muted)] shadow-[var(--st-shadow-sm)] ring-1 ring-[var(--st-border)]"
                        : "hover:!bg-[var(--st-bg-secondary)]",
                    )}
                  >
                    <span className="flex w-full items-start gap-3">
                      <Avatar className="h-10 w-10 border border-[var(--st-border)] bg-[var(--st-bg)]">
                        <AvatarFallback
                          className={cn(
                            "text-sm font-medium",
                            isUnread && !selected
                              ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                              : "",
                          )}
                        >
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm text-[var(--st-text)]",
                              isUnread && !selected ? "font-semibold" : "font-medium",
                            )}
                          >
                            {visitorEmail}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[10px] text-[var(--st-text-tertiary)]">
                            {formatDistanceToNow(new Date(convo.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block max-w-[220px] truncate text-xs",
                            isUnread && !selected
                              ? "font-medium text-[var(--st-text)]"
                              : "text-[var(--st-text-secondary)]",
                          )}
                        >
                          {lastMessage?.sender === "agent" ? "You: " : ""}
                          {lastMessage?.content || "No messages yet."}
                        </span>
                      </span>
                      {isUnread && !selected && (
                        <span className="self-center h-2 w-2 shrink-0 rounded-full bg-[var(--st-accent)]" />
                      )}
                    </span>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={MessageSquare}
              title="No conversations found."
              description="Try adjusting your filters or search."
              size="sm"
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* chat window (thread + composer) */

function ChatMessageBubble({
  message,
  isAgent,
}: {
  message: SabChatMessage;
  isAgent: boolean;
}) {
  const [translated, setTranslated] = useState(false);
  const isWhisper = false; // Mock internal note

  return (
    <div
      className={cn(
        "flex items-end gap-2 group",
        isAgent ? "justify-end" : "justify-start",
      )}
    >
      {!isAgent && (
        <Avatar className="h-8 w-8 self-end mb-1 border border-[var(--st-border)] shadow-[var(--st-shadow-sm)]">
          <AvatarFallback className="text-[10px]">V</AvatarFallback>
        </Avatar>
      )}

      {/* Translation Button (Hover) */}
      {!isAgent && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          <IconButton
            label={translated ? "Show original" : "Translate message"}
            icon={Languages}
            size="sm"
            onClick={() => setTranslated(!translated)}
          />
        </span>
      )}

      <div
        className={cn(
          "flex max-w-[70%] flex-col rounded-[var(--st-radius)] px-4 py-2.5 text-[13px] shadow-[var(--st-shadow-sm)]",
          isAgent
            ? isWhisper
              ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-br-none border border-[var(--st-border)]"
              : "rounded-br-none bg-[var(--st-text)] text-[var(--st-text-inverted)]"
            : "rounded-bl-none bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)]",
        )}
      >
        {isWhisper && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold uppercase opacity-70">
            <EyeOff className="h-3 w-3" /> Internal Note
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">
          {translated ? "[Translated] " + message.content : message.content}
        </p>
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1.5 self-end text-[10px]",
            isAgent
              ? isWhisper
                ? "text-[var(--st-text-secondary)]"
                : "text-[var(--st-text-inverted)]/70"
              : "text-[var(--st-text-tertiary)]",
          )}
        >
          <p>{format(new Date(message.timestamp), "p")}</p>
        </div>
      </div>
    </div>
  );
}

function SendButton({ isWhisper }: { isWhisper: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="sm"
      loading={pending}
      iconLeft={pending ? undefined : Send}
    >
      {isWhisper ? "Add Note" : "Send"}
    </Button>
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
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Advanced features state
  const [isWhisper, setIsWhisper] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  useEffect(() => {
    if (sendState.error) {
      toast.error({
        title: "Error sending message",
        description: sendState.error,
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
    <div className="flex h-full flex-row bg-transparent">
      <div className="flex flex-1 flex-col border-r border-[var(--st-border)] min-w-0">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4">
          <div className="flex items-center gap-3">
            <span className="md:hidden">
              <IconButton label="Back to inbox" icon={ArrowLeft} size="sm" onClick={onBack} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--st-text)] truncate">
                  {visitorEmail}
                </h3>
                <Badge tone="success" dot>
                  Online
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                <span>{session.status === "open" ? "Open" : "Resolved"}</span>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 2m response time
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton label="Add labels" icon={Tag} />
                </TooltipTrigger>
                <TooltipContent>Add labels</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton label="Snooze conversation" icon={Clock} />
                </TooltipTrigger>
                <TooltipContent>Snooze conversation</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant={session.status === "open" ? "outline" : "secondary"}
              size="sm"
              className="ml-2"
              iconLeft={CheckCircle2}
            >
              {session.status === "open" ? "Resolve" : "Reopen"}
            </Button>

            <span className="ml-1 hidden lg:flex">
              <IconButton
                label={showRightSidebar ? "Hide contact panel" : "Show contact panel"}
                icon={MoreVertical}
                onClick={() => setShowRightSidebar(!showRightSidebar)}
              />
            </span>
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[var(--st-bg-secondary)]">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex h-full items-center justify-center py-16">
                <Spinner size="lg" label="Loading conversation" />
              </div>
            ) : (
              <div className="space-y-6 p-6">
                <div className="flex justify-center">
                  <Badge variant="secondary">
                    {format(new Date(session.createdAt), "MMM d, yyyy")}
                  </Badge>
                </div>
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
          </ScrollArea>
        </div>

        {/* Advanced Composer */}
        <div className="shrink-0 border-t border-[var(--st-border)] bg-[var(--st-bg)] p-4">
          <div
            className={cn(
              "rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden shadow-[var(--st-shadow-sm)] transition-colors focus-within:border-[var(--st-accent)] focus-within:ring-1 focus-within:ring-[var(--st-accent)]",
              isWhisper &&
                "bg-[var(--st-bg-muted)] border-[var(--st-border)] focus-within:border-[var(--st-border)] focus-within:ring-[var(--st-border)]",
            )}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-[var(--st-border)] px-2 py-1.5 bg-[var(--st-bg-muted)]">
              <div className="flex items-center gap-0.5">
                <IconButton label="Bold" icon={Bold} size="sm" />
                <IconButton label="Italic" icon={Italic} size="sm" />
                <IconButton label="Bulleted list" icon={List} size="sm" />
              </div>
              <div className="flex items-center gap-3 pr-2">
                <Switch
                  checked={isWhisper}
                  onCheckedChange={setIsWhisper}
                  label={
                    <span className="flex items-center gap-1 text-[var(--st-text-secondary)]">
                      <EyeOff className="h-3 w-3" /> Private Note
                    </span>
                  }
                />
              </div>
            </div>

            <form ref={formRef} action={sendFormAction} className="flex flex-col">
              <input type="hidden" name="sessionId" value={session._id.toString()} />
              <input type="hidden" name="sender" value="agent" />

              <Textarea
                name="content"
                aria-label={isWhisper ? "Private note" : "Reply to visitor"}
                placeholder={
                  isWhisper
                    ? "Type a private note..."
                    : "Type your reply... (Use '/' for quick replies)"
                }
                className="min-h-[80px] border-0 focus-visible:ring-0 resize-none bg-transparent rounded-none px-4 py-3"
              />

              <div className="flex items-center justify-between p-2 pt-0">
                <div className="flex items-center gap-1 pl-1">
                  <IconButton label="Attach a file" icon={Paperclip} />
                  <IconButton label="Insert emoji" icon={Smile} />
                  <IconButton label="Insert quick reply" icon={Zap} />
                </div>
                <SendButton isWhisper={isWhisper} />
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Contact Profile */}
      {showRightSidebar && (
        <div className="w-[300px] shrink-0 bg-[var(--st-bg)] hidden lg:flex flex-col overflow-y-auto">
          <div className="p-6 border-b border-[var(--st-border)] text-center flex flex-col items-center">
            <Avatar className="h-20 w-20 mb-4 shadow-[var(--st-shadow-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <AvatarFallback className="text-2xl font-light text-[var(--st-text-secondary)]">
                {initial}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold text-[var(--st-text)]">
              {visitorEmail}
            </h2>
            <p className="text-sm text-[var(--st-text-secondary)]">Visitor</p>
          </div>

          <div className="p-5 space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">
                About
              </h4>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-start gap-3 text-[var(--st-text)]">
                  <MapPin className="h-4 w-4 text-[var(--st-text-secondary)] mt-0.5" />
                  <div>
                    <p>New York, USA</p>
                    <p className="text-xs text-[var(--st-text-secondary)] font-mono">
                      {session.visitorInfo?.ip || "192.168.1.1"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-[var(--st-text)]">
                  <Laptop className="h-4 w-4 text-[var(--st-text-secondary)] mt-0.5" />
                  <div>
                    <p>Mac OS, Chrome</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-[var(--st-text)]">
                  <Globe className="h-4 w-4 text-[var(--st-text-secondary)] mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" title={session.visitorInfo?.page}>
                      {session.visitorInfo?.page || "/"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">
                Tags
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Support</Badge>
                <Badge variant="secondary">Premium</Badge>
                <Button variant="ghost" size="sm" iconLeft={Plus}>
                  Add tag
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">
                Satisfaction
              </h4>
              <div className="flex items-center gap-2 p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <Star className="h-5 w-5 text-[var(--st-warn)] fill-[var(--st-warn)]" />
                <Star className="h-5 w-5 text-[var(--st-warn)] fill-[var(--st-warn)]" />
                <Star className="h-5 w-5 text-[var(--st-warn)] fill-[var(--st-warn)]" />
                <Star className="h-5 w-5 text-[var(--st-warn)] fill-[var(--st-warn)]" />
                <Star className="h-5 w-5 text-[var(--st-border-strong)]" />
                <span className="text-sm font-semibold ml-auto text-[var(--st-text)]">
                  4/5
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* main */

export function ZoruSabChatClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sessionUser } = useProject();

  const conversationIdFromUrl = searchParams.get("conversationId");

  const [conversations, setConversations] = useState<WithId<SabChatSession>[]>([]);
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
        <Alert tone="danger" icon={AlertCircle} className="max-w-md">
          <AlertTitle>Not logged in</AlertTitle>
          <AlertDescription>
            Please log in to use the live chat inbox.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card
      padding="none"
      className="flex h-[calc(100vh-210px)] min-h-[600px] w-full flex-col overflow-hidden shadow-[var(--st-shadow)] border-[var(--st-border)]"
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Pane 1: conversations list */}
        <div
          className={cn(
            "w-full shrink-0 flex-col border-r border-[var(--st-border)] md:w-[320px] bg-[var(--st-bg-secondary)]",
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

        {/* Pane 2: message thread */}
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
            <div className="hidden h-full flex-col items-center justify-center bg-[var(--st-bg-secondary)] p-8 md:flex">
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description="Choose a chat from the left panel to start messaging with visitors."
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
