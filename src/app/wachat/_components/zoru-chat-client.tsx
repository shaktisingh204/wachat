"use client";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Modal,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Select,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
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
import { ChatWindow } from "./chat/zoru-chat-window";
import { ContactInfoPanel } from "./chat/zoru-contact-info-panel";

/**
 * /wachat/chat — 20ui rebuild of `ChatClient`.
 *
 * Three-pane workspace:
 *   1. Conversations list  (rebuilt inline with 20ui primitives)
 *   2. Message thread      (pure 20ui ChatWindow — preserves
 *                           every server-action call: send-message,
 *                           attachments, reactions, reply, etc.)
 *   3. Contact info panel  (pure 20ui ContactInfoPanel —
 *                           preserves contact-edit server actions;
 *                           presented in a Drawer on mobile, side
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
 */

import * as React from "react";

/** Local class-join helper (20ui ships no `cn`). */
function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const _CONTACTS_PER_PAGE = 30;

/* ── skeleton ─────────────────────────────────────────────────────── */

function ChatPageSkeleton() {
  return (
    <div className="ui20 flex h-full w-full gap-3 p-3">
      <Skeleton className="h-full w-[320px] shrink-0" />
      <Skeleton className="h-full flex-1" />
      <Skeleton className="hidden h-full w-[300px] shrink-0 lg:block" />
    </div>
  );
}

function ContactRowSkeleton() {
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

/* ── new-chat dialog (20ui rebuild of NewChatDialog) ──────────────── */

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
  const formId = React.useId();

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
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Start new conversation"
      description="Select the country code and enter the phone number to start a new chat."
      className="max-h-[85vh]"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={loading}
            disabled={loading || !phoneNumber}
          >
            Start chat
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Field label="Phone number" id="new-chat-phone">
          <div className="flex gap-2">
            <Popover
              open={openCombobox}
              onOpenChange={setOpenCombobox}
              modal
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  aria-label="Select country code"
                  className="w-[140px] justify-between"
                  type="button"
                  iconRight={ChevronsUpDown}
                >
                  {selectedCountry
                    ? `+${selectedCountry.code}`
                    : "Select..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country..." />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {countryCodes.map((country) => (
                        <CommandItem
                          key={`${country.code}-${country.name}`}
                          value={`${country.name} +${country.code}`}
                          onSelect={() => {
                            setSelectedCountryName(country.name);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cx(
                              "mr-2 h-4 w-4",
                              selectedCountryName === country.name
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="flex-1 truncate">
                            {country.name}
                          </span>
                          <span
                            className="ml-2"
                            style={{ color: "var(--st-text-muted)" }}
                          >
                            +{country.code}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              id="new-chat-phone"
              name="phoneNumber"
              placeholder="e.g. 9876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="flex-1"
              required
              type="tel"
            />
          </div>
        </Field>
        <p className="mt-2 text-xs" style={{ color: "var(--st-text-muted)" }}>
          Format:{" "}
          {selectedCountry
            ? `+${selectedCountry.code} 9876543210`
            : "Select country code first"}
        </p>
      </form>
    </Modal>
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

  const phoneOptions = useMemo(
    () =>
      phoneNumbers.map((phone) => ({
        value: phone.id,
        label: `${phone.display_phone_number} (${phone.verified_name})`,
      })),
    [phoneNumbers],
  );

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: "var(--st-bg)" }}
    >
      {/* Header — current user + new-chat trigger */}
      <div
        className="flex shrink-0 items-center justify-between border-b p-3"
        style={{ borderColor: "var(--st-border)" }}
      >
        {sessionUser ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={sessionUser.name}
              src={`https://i.pravatar.cc/150?u=${sessionUser.email}`}
            />
            <p style={{ color: "var(--st-text)" }}>{sessionUser.name}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNewChat();
          }}
          aria-label="New chat"
          iconLeft={MessageSquarePlus}
        />
      </div>

      {/* Search + phone-number select */}
      <div
        className="shrink-0 space-y-3 border-b p-3"
        style={{ borderColor: "var(--st-border)" }}
      >
        <Input
          placeholder="Search or start new chat"
          aria-label="Search or start new chat"
          iconLeft={Search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Select
          value={selectedPhoneNumberId || null}
          onChange={(v) => onPhoneNumberChange(v ?? "")}
          options={phoneOptions}
          placeholder="Select a phone number..."
          aria-label="Select a phone number"
          disabled={phoneNumbers.length === 0}
        />
      </div>

      {/* All / Unread segmented filter */}
      <div
        className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2"
        style={{ borderColor: "var(--st-border)" }}
      >
        <button
          type="button"
          onClick={() => setChatFilter("all")}
          aria-pressed={chatFilter === "all"}
          className="rounded-full px-3 py-1 text-[11px] transition-colors"
          style={
            chatFilter === "all"
              ? { background: "var(--st-text)", color: "var(--st-text-inverted)" }
              : { background: "var(--st-bg-muted)", color: "var(--st-text-muted)" }
          }
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setChatFilter("unread")}
          aria-pressed={chatFilter === "unread"}
          className="rounded-full px-3 py-1 text-[11px] transition-colors"
          style={
            chatFilter === "unread"
              ? { background: "var(--st-text)", color: "var(--st-text-inverted)" }
              : { background: "var(--st-bg-muted)", color: "var(--st-text-muted)" }
          }
        >
          Unread{unreadCount > 0 && ` (${unreadCount})`}
        </button>
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
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
                  className="mx-2 mb-1 flex w-[calc(100%-16px)] items-start gap-3 rounded-[var(--st-radius)] p-3 text-left transition-colors"
                  style={
                    selected
                      ? {
                          background: "var(--st-bg-muted)",
                          boxShadow: "var(--st-shadow-sm)",
                        }
                      : undefined
                  }
                >
                  <Avatar
                    name={(contact.name || "?").toUpperCase()}
                    initials={(contact.name || "?").charAt(0).toUpperCase()}
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between">
                      <span
                        className="truncate pr-2"
                        style={{
                          color:
                            unread > 0
                              ? "var(--st-text)"
                              : "var(--st-text-muted)",
                        }}
                      >
                        {contact.name || contact.waId}
                      </span>
                      {lastMsgTime && (
                        <span
                          className="mt-0.5 shrink-0 whitespace-nowrap text-[10px]"
                          style={{ color: "var(--st-text-tertiary)" }}
                        >
                          {format(new Date(lastMsgTime), "HH:mm")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span
                        className="block max-w-[180px] truncate text-xs"
                        style={{ color: "var(--st-text-muted)" }}
                      >
                        {lastMsgContent}
                      </span>
                      {unread > 0 && (
                        <Badge
                          tone="accent"
                          kind="solid"
                          className="ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px]"
                        >
                          {unread}
                        </Badge>
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
                <LoaderCircle
                  className="h-5 w-5 animate-spin"
                  style={{ color: "var(--st-text-muted)" }}
                />
              )}
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center gap-2 p-8 text-center text-sm"
            style={{ color: "var(--st-text-muted)" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: "var(--st-bg-muted)",
                color: "var(--st-text-muted)",
              }}
            >
              <Users className="h-5 w-5" />
            </div>
            <div>
              No contacts found
              {searchQuery ? " for your search" : " for this number"}.
            </div>
            {!searchQuery && (
              <Link
                href="/wachat/contacts"
                className="u-btn u-btn--outline u-btn--sm mt-2 inline-flex"
              >
                <span className="u-btn__label">Import or add contacts</span>
              </Link>
            )}
          </div>
        )}
      </ScrollArea>
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
  const { toast } = useToast();

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
        setSelectedContact(initialData.selectedContact ?? null);
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
        tone: "danger",
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
        tone: "danger",
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
        tone: "danger",
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
      <div className="ui20 flex h-full items-center justify-center p-4">
        <Alert
          tone="danger"
          title="No project selected"
          icon={AlertCircle}
          className="max-w-md"
        >
          Please select a project from the main dashboard to use the chat
          interface.
        </Alert>
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
      <div
        className="ui20 flex h-full w-full flex-col overflow-hidden"
        style={{ background: "var(--st-bg)" }}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Pane 1 — conversations list */}
          <div
            className={cx(
              "w-full shrink-0 flex-col border-r md:w-[380px]",
              selectedContact ? "hidden md:flex" : "flex",
            )}
            style={{ borderColor: "var(--st-border)" }}
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
            className={cx(
              "relative w-full flex-1 flex-col",
              selectedContact ? "flex" : "hidden md:flex",
            )}
          >
            {selectedContact && activeProject ? (
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
              <div
                className="hidden h-full flex-col items-center justify-center gap-4 p-8 text-center md:flex"
                style={{
                  background: "var(--st-bg-secondary)",
                  color: "var(--st-text-muted)",
                }}
              >
                <div
                  className="mb-2 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: "var(--st-bg-muted)" }}
                >
                  <MessageSquare
                    className="h-10 w-10"
                    style={{ color: "var(--st-text-tertiary)" }}
                  />
                </div>
                <h2 className="text-xl" style={{ color: "var(--st-text)" }}>
                  Select a conversation
                </h2>
                <p className="max-w-xs text-sm">
                  Choose a contact from the list or start a new chat to begin
                  messaging.
                </p>
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => setIsNewChatDialogOpen(true)}
                >
                  Start new conversation
                </Button>
              </div>
            )}
          </div>

          {/* Pane 3 — contact info (desktop side panel) */}
          {isInfoPanelOpen && selectedContact && activeProject && (
            <div
              className="hidden w-[340px] shrink-0 border-l lg:block"
              style={{
                borderColor: "var(--st-border)",
                background: "var(--st-bg)",
              }}
            >
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

      {/* Pane 3 — contact info (mobile drawer) */}
      <Drawer
        side="right"
        open={isInfoPanelOpen && !!selectedContact}
        onOpenChange={(o) => {
          if (!o) setIsInfoPanelOpen(false);
        }}
      >
        <DrawerContent
          side="right"
          className="w-full max-w-md overflow-y-auto p-0 lg:hidden"
        >
          <DrawerHeader className="px-6 pt-6">
            <DrawerTitle>Contact info</DrawerTitle>
          </DrawerHeader>
          {selectedContact && activeProject && (
            <ContactInfoPanel
              project={activeProject}
              contact={selectedContact}
              onContactUpdate={handleContactUpdate}
              onClose={() => setIsInfoPanelOpen(false)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
