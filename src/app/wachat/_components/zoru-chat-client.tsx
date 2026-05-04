"use client";

/**
 * /wachat/chat — ZoruUI rebuild of `ChatClient`.
 *
 * Three-pane workspace:
 *   1. Conversations list  (rebuilt inline with Zoru primitives)
 *   2. Message thread      (existing wabasimplify ChatWindow — preserves
 *                           every server-action call: send-message,
 *                           attachments, reactions, reply, etc.)
 *   3. Contact info panel  (existing wabasimplify ContactInfoPanel —
 *                           preserves contact-edit server actions;
 *                           presented in a ZoruSheet on mobile, side
 *                           panel on lg+ desktop).
 *
 * Server-action wiring preserved end-to-end:
 *   - getInitialChatData(projectId, phoneId, contactId)
 *   - getConversation(contactId)
 *   - markConversationAsRead(contactId)
 *   - findOrCreateContact(projectId, phoneNumberId, waId)
 *   - getContactsPageData(projectId, phoneNumberId, page, '')
 *
 * Polling, infinite-scroll, and reaction-merge logic mirror the legacy
 * `ChatClient` exactly.
 *
 * TODO: Two children remain imported from `@/components/wabasimplify`
 * because they embed deep server-action wiring that's out of scope for
 * the visual-shell rebuild:
 *   - <ChatWindow>           → wraps ChatMessage + ChatMessageInput
 *                              (send-message, attachments, reactions)
 *   - <ContactInfoPanel>     → 368 lines of contact-edit server actions
 * They are used as black-box children. The rest of the UI (contact
 * roster, new-chat dialog, mobile sheet, alerts, skeleton) is pure
 * Zoru.
 */

import * as React from "react";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  LoaderCircle,
  MessageSquare,
  MessageSquarePlus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { WithId } from "mongodb";

import {
  getInitialChatData,
  getConversation,
  markConversationAsRead,
  findOrCreateContact,
} from "@/app/actions/index";
import { getContactsPageData } from "@/app/actions/contact.actions";
import type {
  Project,
  Contact,
  AnyMessage,
  Template,
} from "@/lib/definitions";
import { useProject } from "@/context/project-context";
import { countryCodes } from "@/lib/country-codes";

// Black-box children — preserve their server-action wiring untouched.
import { ChatWindow } from "@/components/wabasimplify/chat-window";
import { ContactInfoPanel } from "@/components/wabasimplify/contact-info-panel";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruButton,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruScrollArea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  useZoruToast,
  cn,
} from "@/components/zoruui";

const _CONTACTS_PER_PAGE = 30;

/* ── skeleton ─────────────────────────────────────────────────────── */

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <ZoruSkeleton className="h-full w-[320px] shrink-0" />
      <ZoruSkeleton className="h-full flex-1" />
      <ZoruSkeleton className="hidden h-full w-[300px] shrink-0 lg:block" />
    </div>
  );
}

function ContactRowSkeleton() {
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

/* ── new-chat dialog (Zoru rebuild of NewChatDialog) ──────────────── */

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (waId: string) => Promise<void>;
}

function ZoruNewChatDialog({
  open,
  onOpenChange,
  onStartChat,
}: NewChatDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountryName, setSelectedCountryName] = useState("India");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCountry = useMemo(
    () => countryCodes.find((c) => c.name === selectedCountryName),
    [selectedCountryName],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !selectedCountry) return;
    setLoading(true);
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const fullWaId = `${selectedCountry.code}${cleanPhone}`;
    await onStartChat(fullWaId);
    setPhoneNumber("");
    setLoading(false);
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-[425px]">
        <form
          onSubmit={handleSubmit}
          className="flex h-full flex-col overflow-hidden"
        >
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Start new conversation</ZoruDialogTitle>
            <ZoruDialogDescription>
              Select the country code and enter the phone number to start a
              new chat.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="space-y-2">
              <ZoruLabel htmlFor="zoru-new-chat-phone">Phone number</ZoruLabel>
              <div className="flex gap-2">
                <ZoruPopover
                  open={openCombobox}
                  onOpenChange={setOpenCombobox}
                  modal
                >
                  <ZoruPopoverTrigger asChild>
                    <ZoruButton
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-[140px] justify-between"
                      type="button"
                    >
                      {selectedCountry
                        ? `+${selectedCountry.code}`
                        : "Select..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </ZoruButton>
                  </ZoruPopoverTrigger>
                  <ZoruPopoverContent className="w-[300px] p-0" align="start">
                    <ZoruCommand>
                      <ZoruCommandInput placeholder="Search country..." />
                      <ZoruCommandList className="max-h-[300px] overflow-y-auto">
                        <ZoruCommandEmpty>No country found.</ZoruCommandEmpty>
                        <ZoruCommandGroup>
                          {countryCodes.map((country) => (
                            <ZoruCommandItem
                              key={`${country.code}-${country.name}`}
                              value={`${country.name} +${country.code}`}
                              onSelect={() => {
                                setSelectedCountryName(country.name);
                                setOpenCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCountryName === country.name
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="flex-1 truncate">
                                {country.name}
                              </span>
                              <span className="ml-2 text-zoru-ink-muted">
                                +{country.code}
                              </span>
                            </ZoruCommandItem>
                          ))}
                        </ZoruCommandGroup>
                      </ZoruCommandList>
                    </ZoruCommand>
                  </ZoruPopoverContent>
                </ZoruPopover>
                <ZoruInput
                  id="zoru-new-chat-phone"
                  name="phoneNumber"
                  placeholder="e.g. 9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1"
                  required
                  type="tel"
                />
              </div>
              <p className="text-xs text-zoru-ink-muted">
                Format:{" "}
                {selectedCountry
                  ? `+${selectedCountry.code} 9876543210`
                  : "Select country code first"}
              </p>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pt-2 pb-6">
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={loading || !phoneNumber}>
              {loading && <LoaderCircle className="animate-spin" />}
              Start chat
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── conversation list pane ───────────────────────────────────────── */

interface ContactListProps {
  sessionUser: ReturnType<typeof useProject>["sessionUser"];
  project: WithId<Project> | null;
  contacts: WithId<Contact>[];
  selectedContactId?: string;
  onSelectContact: (contact: WithId<Contact>) => void;
  onNewChat: () => void;
  isLoading: boolean;
  hasMoreContacts: boolean;
  loadMoreRef: React.Ref<HTMLDivElement>;
  selectedPhoneNumberId: string;
  onPhoneNumberChange: (phoneId: string) => void;
}

function ZoruContactListPane({
  sessionUser,
  project,
  contacts,
  selectedContactId,
  onSelectContact,
  onNewChat,
  isLoading,
  hasMoreContacts,
  loadMoreRef,
  selectedPhoneNumberId,
  onPhoneNumberChange,
}: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "unread">("all");

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
  }, 300);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (chatFilter === "unread") {
      result = result.filter((c) => (c.unreadCount || 0) > 0);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.waId.includes(searchQuery),
      );
    }
    return result;
  }, [contacts, searchQuery, chatFilter]);

  const unreadCount = useMemo(
    () => contacts.filter((c) => (c.unreadCount || 0) > 0).length,
    [contacts],
  );

  const phoneNumbers = project?.phoneNumbers || [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zoru-bg">
      {/* Header — current user + new-chat trigger */}
      <div className="flex shrink-0 items-center justify-between border-b border-zoru-line p-3">
        {sessionUser ? (
          <div className="flex items-center gap-3">
            <ZoruAvatar>
              <ZoruAvatarImage
                src={`https://i.pravatar.cc/150?u=${sessionUser.email}`}
                alt={sessionUser.name}
              />
              <ZoruAvatarFallback>
                {sessionUser.name.charAt(0)}
              </ZoruAvatarFallback>
            </ZoruAvatar>
            <p className="text-zoru-ink">{sessionUser.name}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ZoruSkeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <ZoruSkeleton className="h-4 w-24" />
              <ZoruSkeleton className="h-3 w-16" />
            </div>
          </div>
        )}
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNewChat();
          }}
          aria-label="New chat"
        >
          <MessageSquarePlus />
        </ZoruButton>
      </div>

      {/* Search + phone-number select */}
      <div className="shrink-0 space-y-3 border-b border-zoru-line p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <ZoruInput
            placeholder="Search or start new chat"
            className="pl-8"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <ZoruSelect
          value={selectedPhoneNumberId}
          onValueChange={onPhoneNumberChange}
          disabled={phoneNumbers.length === 0}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue placeholder="Select a phone number..." />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {phoneNumbers.map((phone) => (
              <ZoruSelectItem key={phone.id} value={phone.id}>
                {phone.display_phone_number} ({phone.verified_name})
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
      </div>

      {/* All / Unread segmented filter */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zoru-line px-3 py-2">
        <button
          type="button"
          onClick={() => setChatFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] transition-colors",
            chatFilter === "all"
              ? "bg-zoru-ink text-zoru-on-primary"
              : "bg-zoru-surface-2 text-zoru-ink-muted hover:bg-zoru-surface",
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setChatFilter("unread")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] transition-colors",
            chatFilter === "unread"
              ? "bg-zoru-ink text-zoru-on-primary"
              : "bg-zoru-surface-2 text-zoru-ink-muted hover:bg-zoru-surface",
          )}
        >
          Unread{unreadCount > 0 && ` (${unreadCount})`}
        </button>
      </div>

      {/* Contact list */}
      <ZoruScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <ContactRowSkeleton key={i} />
            ))}
          </div>
        ) : filteredContacts.length > 0 ? (
          <>
            {filteredContacts.map((contact) => {
              const id = contact._id.toString();
              const unread = contact.unreadCount || 0;
              const lastMsgTime = contact.lastMessageTimestamp;
              const lastMsgContent = contact.lastMessage || "No messages yet.";
              const selected = selectedContactId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectContact(contact)}
                  className={cn(
                    "mx-2 mb-1 flex w-[calc(100%-16px)] items-start gap-3 rounded-[var(--zoru-radius)] p-3 text-left transition-colors",
                    selected
                      ? "bg-zoru-surface-2 shadow-[var(--zoru-shadow-sm)]"
                      : "hover:bg-zoru-surface",
                  )}
                >
                  <ZoruAvatar>
                    <ZoruAvatarFallback>
                      {(contact.name || "?").charAt(0).toUpperCase()}
                    </ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          "truncate pr-2",
                          unread > 0
                            ? "text-zoru-ink"
                            : "text-zoru-ink-muted",
                        )}
                      >
                        {contact.name || contact.waId}
                      </span>
                      {lastMsgTime && (
                        <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-zoru-ink-subtle">
                          {format(new Date(lastMsgTime), "HH:mm")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="block max-w-[180px] truncate text-xs text-zoru-ink-muted">
                        {lastMsgContent}
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
            })}
            <div
              ref={loadMoreRef}
              className="flex items-center justify-center p-4"
            >
              {hasMoreContacts && (
                <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-zoru-ink-muted">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
              <Users className="h-5 w-5" />
            </div>
            <div>
              No contacts found
              {searchQuery ? " for your search" : " for this number"}.
            </div>
            {!searchQuery && (
              <ZoruButton
                asChild
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <Link href="/wachat/contacts">Import or add contacts</Link>
              </ZoruButton>
            )}
          </div>
        )}
      </ZoruScrollArea>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */

export function ZoruChatClient() {
  const searchParams = useSearchParams();
  const { activeProject, activeProjectId, sessionUser } = useProject();

  const initialContactId = useMemo(
    () => searchParams.get("contactId"),
    [searchParams],
  );
  const initialPhoneId = useMemo(
    () => searchParams.get("phoneId"),
    [searchParams],
  );

  const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
  const [selectedContact, setSelectedContact] =
    useState<WithId<Contact> | null>(null);
  const [conversation, setConversation] = useState<AnyMessage[]>([]);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);

  const [isLoading, startLoadingTransition] = useTransition();
  const [loadingConversation, startConversationLoadTransition] = useTransition();
  const [, startPollingTransition] = useTransition();

  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const { toast } = useZoruToast();

  // Pagination state for contacts
  const [contactPage, setContactPage] = useState(1);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadMoreContactsRef = useRef<HTMLDivElement>(null);

  /* ── initial data load ── */
  const fetchInitialData = useCallback(
    async (phoneId?: string | null) => {
      if (!activeProjectId) return;
      startLoadingTransition(async () => {
        const initialData = await getInitialChatData(
          activeProjectId,
          phoneId || initialPhoneId,
          initialContactId,
        );

        setContacts(initialData.contacts);
        setHasMoreContacts(
          initialData.contacts.length < initialData.totalContacts,
        );
        setSelectedContact(initialData.selectedContact);
        setConversation(initialData.conversation);
        setTemplates(initialData.templates);
        setSelectedPhoneNumberId(initialData.selectedPhoneNumberId);
        setContactPage(1);
      });
    },
    [activeProjectId, initialContactId, initialPhoneId],
  );

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handlePhoneNumberChange = (phoneId: string) => {
    setSelectedContact(null);
    setConversation([]);
    fetchInitialData(phoneId);
  };

  const handleSelectContact = useCallback(
    async (contact: WithId<Contact>) => {
      setSelectedContact(contact);
      startConversationLoadTransition(async () => {
        const conversationData = await getConversation(contact._id.toString());
        setConversation(conversationData);
      });

      if (contact.unreadCount && contact.unreadCount > 0) {
        await markConversationAsRead(contact._id.toString());
        setContacts((prev) =>
          prev.map((c) =>
            c._id.toString() === contact._id.toString()
              ? { ...c, unreadCount: 0 }
              : c,
          ),
        );
      }
    },
    [],
  );

  /* ── infinite scroll: load more contacts ── */
  const loadMoreContacts = useCallback(async () => {
    if (
      !activeProject ||
      !selectedPhoneNumberId ||
      isFetchingMore ||
      !hasMoreContacts
    )
      return;

    setIsFetchingMore(true);
    try {
      const nextPage = contactPage + 1;
      const { contacts: newContacts, total } = await getContactsPageData(
        activeProject._id.toString(),
        selectedPhoneNumberId,
        nextPage,
        "",
      );

      if (newContacts.length > 0) {
        setContacts((prev) => [...prev, ...newContacts]);
        setContactPage(nextPage);
      }
      setHasMoreContacts(contacts.length + newContacts.length < total);
    } catch (error) {
      console.error("Failed to fetch more contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load more contacts.",
        variant: "destructive",
      });
      setHasMoreContacts(false);
    } finally {
      setIsFetchingMore(false);
    }
  }, [
    activeProject,
    selectedPhoneNumberId,
    isFetchingMore,
    hasMoreContacts,
    contactPage,
    contacts.length,
    toast,
  ]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingMore) {
          loadMoreContacts();
        }
      },
      { threshold: 1.0 },
    );

    const currentRef = loadMoreContactsRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMoreContacts, isFetchingMore]);

  /* ── polling for real-time updates ── */
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      startPollingTransition(async () => {
        if (activeProject && selectedPhoneNumberId) {
          const { contacts: updatedContacts } = await getContactsPageData(
            activeProject._id.toString(),
            selectedPhoneNumberId,
            1,
            "",
          );
          setContacts((prev) => {
            const updatedMap = new Map(
              updatedContacts.map((c) => [c._id.toString(), c]),
            );
            const mergedContacts = prev.map(
              (old) => updatedMap.get(old._id.toString()) || old,
            );
            const existingIds = new Set(
              mergedContacts.map((c) => c._id.toString()),
            );
            const brandNewContacts = updatedContacts.filter(
              (c) => !existingIds.has(c._id.toString()),
            );
            const final = [...brandNewContacts, ...mergedContacts];
            return final.sort(
              (a, b) =>
                new Date(b.lastMessageTimestamp || 0).getTime() -
                new Date(a.lastMessageTimestamp || 0).getTime(),
            );
          });
        }
        if (selectedContact) {
          const conversationData = await getConversation(
            selectedContact._id.toString(),
          );
          setConversation(conversationData);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContact, activeProject, selectedPhoneNumberId, isLoading]);

  /* ── new-chat handler ── */
  const handleNewChat = async (waId: string) => {
    if (!activeProject || !selectedPhoneNumberId) {
      toast({
        title: "Error",
        description: "Project and phone number must be selected.",
        variant: "destructive",
      });
      return;
    }
    const { contact, error } = await findOrCreateContact(
      activeProjectId!,
      selectedPhoneNumberId,
      waId,
    );
    if (error || !contact) {
      toast({
        title: "Error",
        description: error || "Could not find or create contact.",
        variant: "destructive",
      });
    }
    if (contact) {
      setContacts((prev) => [
        contact,
        ...prev.filter((c) => c._id.toString() !== contact?._id.toString()),
      ]);
      handleSelectContact(contact);
      setIsNewChatDialogOpen(false);
    }
  };

  /* ── contact-update handler ── */
  const handleContactUpdate = (updatedContact: WithId<Contact>) => {
    setSelectedContact(updatedContact);
    setContacts((prev) =>
      prev.map((c) =>
        c._id.toString() === updatedContact._id.toString()
          ? updatedContact
          : c,
      ),
    );
  };

  /* ── reaction-merge for the thread ── */
  const processedConversation = useMemo(() => {
    const reactionsMap = new Map<string, AnyMessage["reaction"]>();
    const messagesWithoutReactions: AnyMessage[] = [];

    for (const message of conversation) {
      if (
        message.type === "reaction" &&
        message.content.reaction?.message_id
      ) {
        reactionsMap.set(
          message.content.reaction.message_id,
          message.content.reaction,
        );
      } else {
        messagesWithoutReactions.push(message);
      }
    }

    return messagesWithoutReactions.map((message) => {
      const reaction = reactionsMap.get(message.wamid);
      return reaction ? { ...message, reaction } : message;
    });
  }, [conversation]);

  /* ── early returns ── */
  if (isLoading && !activeProject) {
    return <ChatPageSkeleton />;
  }

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ZoruAlert variant="destructive" className="max-w-md">
          <AlertCircle />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please select a project from the main dashboard to use the chat
            interface.
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  /* ── render ── */
  return (
    <>
      <ZoruNewChatDialog
        open={isNewChatDialogOpen}
        onOpenChange={setIsNewChatDialogOpen}
        onStartChat={handleNewChat}
      />
      <div className="flex h-full w-full flex-col overflow-hidden bg-zoru-bg">
        <div className="flex flex-1 overflow-hidden">
          {/* Pane 1 — conversations list */}
          <div
            className={cn(
              "w-full shrink-0 flex-col border-r border-zoru-line md:w-[380px]",
              selectedContact ? "hidden md:flex" : "flex",
            )}
          >
            <ZoruContactListPane
              sessionUser={sessionUser}
              project={activeProject}
              contacts={contacts}
              selectedContactId={selectedContact?._id.toString()}
              onSelectContact={handleSelectContact}
              onNewChat={() => setIsNewChatDialogOpen(true)}
              isLoading={isLoading && contacts.length === 0}
              hasMoreContacts={hasMoreContacts}
              loadMoreRef={loadMoreContactsRef}
              selectedPhoneNumberId={selectedPhoneNumberId}
              onPhoneNumberChange={handlePhoneNumberChange}
            />
          </div>

          {/* Pane 2 — message thread */}
          <div
            className={cn(
              "relative w-full flex-1 flex-col",
              selectedContact ? "flex" : "hidden md:flex",
            )}
          >
            {selectedContact && activeProject ? (
              // TODO: ChatWindow remains imported from wabasimplify because
              // its child ChatMessageInput contains the message-send
              // server-action wiring (templates, attachments, reactions)
              // which is out of scope for the visual-shell rebuild.
              <ChatWindow
                key={selectedContact._id.toString()}
                project={activeProject}
                contact={selectedContact}
                conversation={processedConversation}
                templates={templates}
                isLoading={loadingConversation}
                onBack={() => setSelectedContact(null)}
                onContactUpdate={handleContactUpdate}
                onInfoToggle={() => setIsInfoPanelOpen((p) => !p)}
                isInfoPanelOpen={isInfoPanelOpen}
              />
            ) : (
              <div className="hidden h-full flex-col items-center justify-center gap-4 bg-zoru-surface p-8 text-center text-zoru-ink-muted md:flex">
                <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-zoru-surface-2">
                  <MessageSquare className="h-10 w-10 text-zoru-ink-subtle" />
                </div>
                <h2 className="text-xl text-zoru-ink">Select a conversation</h2>
                <p className="max-w-xs text-sm">
                  Choose a contact from the list or start a new chat to begin
                  messaging.
                </p>
                <ZoruButton
                  className="mt-4"
                  onClick={() => setIsNewChatDialogOpen(true)}
                >
                  Start new conversation
                </ZoruButton>
              </div>
            )}
          </div>

          {/* Pane 3 — contact info (desktop side panel) */}
          {isInfoPanelOpen && selectedContact && activeProject && (
            <div className="hidden w-[340px] shrink-0 border-l border-zoru-line bg-zoru-bg lg:block">
              {/* TODO: ContactInfoPanel remains imported from wabasimplify;
                  368 lines of contact-edit server-action wiring is out of
                  scope for the visual-shell rebuild. */}
              <ContactInfoPanel
                project={activeProject}
                contact={selectedContact}
                onContactUpdate={handleContactUpdate}
                onClose={() => setIsInfoPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Pane 3 — contact info (mobile sheet) */}
      <ZoruSheet
        open={isInfoPanelOpen && !!selectedContact}
        onOpenChange={(o) => {
          if (!o) setIsInfoPanelOpen(false);
        }}
      >
        <ZoruSheetContent
          side="right"
          className="w-full max-w-md overflow-y-auto p-0 lg:hidden"
        >
          <ZoruSheetHeader className="px-6 pt-6">
            <ZoruSheetTitle>Contact info</ZoruSheetTitle>
          </ZoruSheetHeader>
          {selectedContact && activeProject && (
            <ContactInfoPanel
              project={activeProject}
              contact={selectedContact}
              onContactUpdate={handleContactUpdate}
              onClose={() => setIsInfoPanelOpen(false)}
            />
          )}
        </ZoruSheetContent>
      </ZoruSheet>
    </>
  );
}
