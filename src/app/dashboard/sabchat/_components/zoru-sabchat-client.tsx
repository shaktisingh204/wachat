"use client";

import {
  cn,
  useZoruToast,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Button,
  Card,
  Input,
  ScrollArea,
  Skeleton,
  Switch,
  Label,
  Checkbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruTooltip,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  Textarea,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  Users,
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
  Download,
  Trash2,
  Filter,
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

import * as React from "react";

const sendInitialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

/* ── skeletons ────────────────────────────────────────────────────── */

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
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
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
  const [filterTab, setFilterTab] = useState<'mine' | 'unassigned' | 'all'>('all');
  const [selectedBulk, setSelectedBulk] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
  }, 300);

  const filteredConversations = conversations.filter((convo) => {
    // Advanced filtering mock
    if (filterTab === 'mine') return true; // mock
    if (filterTab === 'unassigned') return convo.status === 'open'; // mock
    
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      convo.visitorInfo?.email?.toLowerCase().includes(q) ||
      convo.history.some((msg) => msg.content.toLowerCase().includes(q))
    );
  });

  const toggleBulk = (id: string) => {
    setSelectedBulk(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zoru-bg">
      {/* Search and Filter */}
      <div className="shrink-0 border-b border-zoru-line p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zoru-ink flex items-center gap-2">
            Inbox
            <Badge variant="secondary" className="px-1.5 py-0 min-w-[20px] text-center justify-center">
              {filteredConversations.length}
            </Badge>
          </h2>
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <Filter className="h-4 w-4" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Filter by status</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem onClick={() => setFilterTab('all')}>All conversations</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onClick={() => setFilterTab('mine')}>Assigned to me</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onClick={() => setFilterTab('unassigned')}>Unassigned</ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onClick={() => setIsBulkMode(!isBulkMode)}>
                {isBulkMode ? "Exit bulk mode" : "Bulk actions"}
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <Input
            placeholder="Search by email or message..."
            className="pl-8 h-9 text-sm"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {isBulkMode && (
          <div className="flex items-center justify-between bg-zoru-surface-2 p-2 rounded-[var(--zoru-radius-sm)]">
            <span className="text-xs font-medium">{selectedBulk.length} selected</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" className="h-6 w-6"><CheckCircle2 className="h-3 w-3" /></Button>
              <Button variant="outline" size="icon-sm" className="h-6 w-6 text-zoru-ink"><Trash2 className="h-3 w-3" /></Button>
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
                      <Checkbox checked={selectedBulk.includes(id)} onCheckedChange={() => toggleBulk(id)} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => !isBulkMode && onSelectConversation(convo)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[var(--zoru-radius)] p-3 text-left transition-colors",
                      isBulkMode && "pl-8",
                      selected
                        ? "bg-zoru-surface-2 shadow-[var(--zoru-shadow-sm)] ring-1 ring-zoru-line"
                        : "hover:bg-zoru-surface",
                    )}
                  >
                    <Avatar className="h-10 w-10 border border-zoru-line bg-zoru-bg">
                      <ZoruAvatarFallback className={cn("text-sm font-medium", isUnread && !selected ? "bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink dark:text-white" : "")}>
                        {initial}
                      </ZoruAvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", isUnread && !selected ? "font-semibold text-zoru-ink" : "font-medium text-zoru-ink")}>
                          {visitorEmail}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[10px] text-zoru-ink-subtle">
                          {formatDistanceToNow(new Date(convo.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={cn("mt-0.5 block max-w-[220px] truncate text-xs", isUnread && !selected ? "font-medium text-zoru-ink" : "text-zoru-ink-muted")}>
                        {lastMessage?.sender === 'agent' ? 'You: ' : ''}{lastMessage?.content || "No messages yet."}
                      </p>
                    </div>
                    {isUnread && !selected && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-zoru-ink" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-zoru-ink-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-subtle">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>No conversations found.</div>
            <p className="text-xs">Try adjusting your filters or search.</p>
          </div>
        )}
      </ScrollArea>
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
        <Avatar className="h-8 w-8 self-end mb-1 border border-zoru-line shadow-sm">
          <ZoruAvatarFallback className="text-[10px]">V</ZoruAvatarFallback>
        </Avatar>
      )}
      
      {/* Translation Button (Hover) */}
      {!isAgent && (
        <Button variant="ghost" size="icon-sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setTranslated(!translated)}>
          <Languages className="h-3.5 w-3.5 text-zoru-ink-muted" />
        </Button>
      )}

      <div
        className={cn(
          "flex max-w-[70%] flex-col rounded-[var(--zoru-radius)] px-4 py-2.5 text-[13px] shadow-[var(--zoru-shadow-sm)]",
          isAgent
            ? isWhisper 
              ? "bg-zoru-surface-2 dark:bg-zoru-ink/30 text-zoru-ink dark:text-white rounded-br-none border border-zoru-line dark:border-zoru-line" 
              : "rounded-br-none bg-zoru-ink text-zoru-on-primary"
            : "rounded-bl-none bg-zoru-surface border border-zoru-line text-zoru-ink",
        )}
      >
        {isWhisper && <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold uppercase opacity-70"><EyeOff className="h-3 w-3" /> Internal Note</div>}
        <p className="whitespace-pre-wrap leading-relaxed">
          {translated ? "[Translated] " + message.content : message.content}
        </p>
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1.5 self-end text-[10px]",
            isAgent 
              ? isWhisper ? "text-zoru-ink dark:text-zoru-ink-muted" : "text-zoru-on-primary/70" 
              : "text-zoru-ink-subtle",
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
      size="sm" 
      disabled={pending} 
      className={cn(isWhisper && "bg-zoru-ink hover:bg-zoru-ink text-white")}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4 mr-1.5" />
      )}
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
  const { toast } = useZoruToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Advanced features state
  const [isWhisper, setIsWhisper] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

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
    <div className="flex h-full flex-row bg-transparent">
      <div className="flex flex-1 flex-col border-r border-zoru-line min-w-0">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zoru-line bg-zoru-bg px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack}>
              <ArrowLeft />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-zoru-ink truncate">{visitorEmail}</h3>
                <Badge variant="outline" className="h-5 text-[10px] px-1.5 gap-1 border-zoru-line bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/50 dark:border-zoru-line">
                  <span className="h-1.5 w-1.5 rounded-full bg-zoru-ink"></span> Online
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-zoru-ink-muted">
                <span>{session.status === 'open' ? 'Open' : 'Resolved'}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> 2m response time</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <ZoruTooltipProvider>
              <ZoruTooltip>
                <ZoruTooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8"><Tag className="h-4 w-4" /></Button>
                </ZoruTooltipTrigger>
                <ZoruTooltipContent>Add labels</ZoruTooltipContent>
              </ZoruTooltip>
            </ZoruTooltipProvider>
            
            <ZoruTooltipProvider>
              <ZoruTooltip>
                <ZoruTooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8"><Clock className="h-4 w-4" /></Button>
                </ZoruTooltipTrigger>
                <ZoruTooltipContent>Snooze conversation</ZoruTooltipContent>
              </ZoruTooltip>
            </ZoruTooltipProvider>
            
            <Button variant={session.status === 'open' ? "outline" : "secondary"} size="sm" className="ml-2">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {session.status === 'open' ? 'Resolve' : 'Reopen'}
            </Button>

            <Button variant="ghost" size="icon-sm" className="ml-1 hidden lg:flex" onClick={() => setShowRightSidebar(!showRightSidebar)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#374151_1px,transparent_1px)]">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex h-full items-center justify-center py-16">
                <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
              </div>
            ) : (
              <div className="space-y-6 p-6">
                <div className="flex justify-center">
                  <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wider text-zoru-ink-subtle bg-zoru-surface-2 border-zoru-line border">
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
        <div className="shrink-0 border-t border-zoru-line bg-zoru-bg p-4">
          <div className={cn("rounded-xl border border-zoru-line bg-zoru-surface overflow-hidden shadow-sm transition-colors focus-within:border-zoru-ink focus-within:ring-1 focus-within:ring-zoru-ink", isWhisper && "bg-zoru-surface-2/50 border-zoru-line focus-within:border-zoru-line focus-within:ring-zoru-line dark:bg-zoru-ink/10 dark:border-zoru-line")}>
            
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-zoru-line/50 px-2 py-1.5 bg-zoru-surface-2/50">
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-zoru-ink-muted"><Bold className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-zoru-ink-muted"><Italic className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-zoru-ink-muted"><List className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center gap-3 pr-2">
                <div className="flex items-center gap-2">
                  <Switch id="whisper-mode" checked={isWhisper} onCheckedChange={setIsWhisper} className="h-4 w-7" />
                  <Label htmlFor="whisper-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1 text-zoru-ink-muted">
                    <EyeOff className="h-3 w-3" /> Private Note
                  </Label>
                </div>
              </div>
            </div>

            <form
              ref={formRef}
              action={sendFormAction}
              className="flex flex-col"
            >
              <input type="hidden" name="sessionId" value={session._id.toString()} />
              <input type="hidden" name="sender" value="agent" />
              
              <Textarea
                name="content"
                placeholder={isWhisper ? "Type a private note..." : "Type your reply... (Use '/' for quick replies)"}
                className="min-h-[80px] border-0 focus-visible:ring-0 resize-none bg-transparent rounded-none px-4 py-3"
              />
              
              <div className="flex items-center justify-between p-2 pt-0">
                <div className="flex items-center gap-1 pl-1">
                  <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 text-zoru-ink-muted rounded-full">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 text-zoru-ink-muted rounded-full">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 text-zoru-ink-muted rounded-full">
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
                <SendButton isWhisper={isWhisper} />
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Contact Profile */}
      {showRightSidebar && (
        <div className="w-[300px] shrink-0 bg-zoru-bg hidden lg:flex flex-col overflow-y-auto">
          <div className="p-6 border-b border-zoru-line text-center flex flex-col items-center">
            <Avatar className="h-20 w-20 mb-4 shadow-sm border border-zoru-line bg-zoru-surface">
              <ZoruAvatarFallback className="text-2xl font-light text-zoru-ink-muted">{initial}</ZoruAvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold text-zoru-ink">{visitorEmail}</h2>
            <p className="text-sm text-zoru-ink-muted">Visitor</p>
          </div>

          <div className="p-5 space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zoru-ink-subtle">About</h4>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-start gap-3 text-zoru-ink">
                  <MapPin className="h-4 w-4 text-zoru-ink-muted mt-0.5" />
                  <div>
                    <p>New York, USA</p>
                    <p className="text-xs text-zoru-ink-muted font-mono">{session.visitorInfo?.ip || "192.168.1.1"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-zoru-ink">
                  <Laptop className="h-4 w-4 text-zoru-ink-muted mt-0.5" />
                  <div>
                    <p>Mac OS • Chrome</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-zoru-ink">
                  <Globe className="h-4 w-4 text-zoru-ink-muted mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" title={session.visitorInfo?.page}>{session.visitorInfo?.page || "/"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zoru-ink-subtle">Tags</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/30 dark:border-zoru-line">Support</Badge>
                <Badge variant="outline" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/30 dark:border-zoru-line">Premium</Badge>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-semibold text-zoru-ink-muted"><Plus className="h-3 w-3 mr-1" /> Add tag</Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zoru-ink-subtle">Satisfaction</h4>
              <div className="flex items-center gap-2 p-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface">
                <Star className="h-5 w-5 text-zoru-ink-muted fill-zoru-ink-muted" />
                <Star className="h-5 w-5 text-zoru-ink-muted fill-zoru-ink-muted" />
                <Star className="h-5 w-5 text-zoru-ink-muted fill-zoru-ink-muted" />
                <Star className="h-5 w-5 text-zoru-ink-muted fill-zoru-ink-muted" />
                <Star className="h-5 w-5 text-zoru-line" />
                <span className="text-sm font-semibold ml-auto text-zoru-ink">4/5</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle />
          <ZoruAlertTitle>Not logged in</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please log in to use the live chat inbox.
          </ZoruAlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card className="flex h-[calc(100vh-210px)] min-h-[600px] w-full flex-col overflow-hidden p-0 shadow-lg border-zoru-line">
      <div className="flex flex-1 overflow-hidden">
        {/* Pane 1 — conversations list */}
        <div
          className={cn(
            "w-full shrink-0 flex-col border-r border-zoru-line md:w-[320px] bg-zoru-surface/50",
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
            <div className="hidden h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] p-8 text-center text-zoru-ink-muted md:flex">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zoru-surface shadow-sm border border-zoru-line">
                <MessageSquare className="h-10 w-10 text-zoru-ink-subtle" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-zoru-ink mb-1">Select a conversation</h2>
                <p className="max-w-xs text-sm">
                  Choose a chat from the left panel to start messaging with visitors.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
