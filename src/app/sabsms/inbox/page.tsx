import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

import {
  loadAgents,
  loadConversations,
  loadTemplates,
  loadThread,
} from "./actions";
import type { InboxFilters } from "./types";
import { formatRelative, computeSlaState, formatDeliveryStatusLabel } from "./sla";

import Link from "next/link";
import {
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Badge,
  ZoruResizablePanelGroup,
  ZoruResizablePanel,
  ZoruResizableHandle,
  ScrollArea,
  Separator,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  Button
} from "@/components/zoruui";

import { Clock, Send, Paperclip, CheckCircle2, UserCheck, Tag, Clock3, MailWarning, Phone, Search, SlidersHorizontal, Image as ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

interface SabsmsInboxPageProps {
  searchParams: Promise<{
    conversationId?: string;
    scope?: string;
    q?: string;
    sort?: string;
    status?: string | string[];
    assignee?: string | string[];
    label?: string | string[];
    from?: string;
    to?: string;
  }>;
}

export default async function SabsmsInboxPage({
  searchParams,
}: SabsmsInboxPageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");

  if (!workspaceId) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <Card className="max-w-md w-full p-8 shadow-[var(--zoru-shadow-lg)] border-zoru-line">
          <ZoruCardTitle className="text-center text-3xl font-bold tracking-tight">Inbox</ZoruCardTitle>
          <ZoruCardDescription className="text-center mt-2 text-lg">
            Sign in to view your SabSMS conversations.
          </ZoruCardDescription>
        </Card>
      </div>
    );
  }

  await connectToDatabase();
  const _collection = SABSMS_COLLECTIONS.conversations;

  const filters: InboxFilters = {
    q: sp.q,
    scope: (sp.scope as InboxFilters["scope"]) ?? "all",
    status: Array.isArray(sp.status) ? sp.status : sp.status ? [sp.status] : undefined,
    assignee: Array.isArray(sp.assignee) ? sp.assignee : sp.assignee ? [sp.assignee] : undefined,
    labels: Array.isArray(sp.label) ? sp.label : sp.label ? [sp.label] : undefined,
    sort: (sp.sort as InboxFilters["sort"]) ?? "newest",
    from: sp.from,
    to: sp.to,
  };

  const [conversations, agents, templates] = await Promise.all([
    loadConversations(workspaceId, filters),
    loadAgents(workspaceId),
    loadTemplates(workspaceId),
  ]);

  const initialThreadId = sp.conversationId ?? conversations[0]?.id ?? null;
  const initialThread = initialThreadId ? await loadThread(workspaceId, initialThreadId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Workspace Inbox</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage and respond to inbound messages, bulky and premium.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="shadow-sm"><SlidersHorizontal className="mr-2 h-4 w-4"/> Filters</Button>
          <Button variant="default" className="shadow-md bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600">
            <Send className="mr-2 h-4 w-4"/> New Broadcast
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden p-0 border-slate-200 shadow-[var(--zoru-shadow-xl)] rounded-xl flex flex-col bg-white">
        <ZoruResizablePanelGroup direction="horizontal" className="h-full items-stretch">
          <ZoruResizablePanel defaultSize={35} minSize={25} maxSize={45} className="bg-slate-50/50 flex flex-col h-full border-r border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search threaded conversations..." 
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200 rounded-lg text-sm transition-all"
                />
              </div>
              <div className="flex gap-2 text-xs font-semibold overflow-x-auto pb-1 hide-scrollbar">
                <Badge variant="default" tone="obsidian" className="shadow-sm whitespace-nowrap cursor-pointer">All Messages</Badge>
                <Badge variant="outline" className="shadow-sm whitespace-nowrap cursor-pointer hover:bg-slate-100">Unread</Badge>
                <Badge variant="outline" className="shadow-sm whitespace-nowrap cursor-pointer hover:bg-slate-100">Assigned to Me</Badge>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col p-3 gap-2">
                {conversations.map((c) => {
                  const isActive = c.id === initialThreadId;
                  return (
                    <Link key={c.id} href={`?conversationId=${c.id}`} className="block">
                      <Card 
                        interactive
                        variant={isActive ? "elevated" : "outline"}
                        className={`p-4 transition-all duration-200 ${isActive ? 'ring-2 ring-slate-900 bg-white border-transparent' : 'bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 border border-slate-200 shadow-sm shrink-0">
                            <ZoruAvatarFallback className="bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700 font-bold">
                              {c.contactId.slice(0, 2).toUpperCase()}
                            </ZoruAvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-900 truncate">{c.contactId}</span>
                              <span className="text-xs text-slate-500 whitespace-nowrap font-medium">{formatRelative(c.lastMessageAt)}</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2 leading-snug">
                              {c.lastMessagePreview || <span className="italic text-slate-400">No message preview</span>}
                            </p>
                            <div className="flex gap-1.5 mt-2.5 flex-wrap">
                              {c.status === "open" && <Badge variant="default" className="text-[10px] h-5" tone="green">Open</Badge>}
                              {c.status === "closed" && <Badge variant="secondary" className="text-[10px] h-5">Closed</Badge>}
                              {c.labels?.map(l => <Badge key={l} variant="outline" className="text-[10px] h-5 bg-slate-50">{l}</Badge>)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </ScrollArea>
          </ZoruResizablePanel>

          <ZoruResizableHandle withHandle className="bg-slate-200 w-[1px] hover:w-1 hover:bg-slate-300 transition-all"/>

          <ZoruResizablePanel defaultSize={65} className="flex flex-col h-full bg-white relative">
            {initialThread ? (
              <>
                <div className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-slate-100 shadow-md">
                      <ZoruAvatarFallback className="bg-slate-900 text-white font-bold text-lg">
                        {initialThread.conversation.contactId.slice(0, 2).toUpperCase()}
                      </ZoruAvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        {initialThread.conversation.contactId}
                        <Badge variant="outline" className="font-mono text-[10px] tracking-wide text-slate-500 bg-slate-50">ID: {initialThread.conversation.id.slice(-6)}</Badge>
                      </h2>
                      <div className="text-sm text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        <Phone className="h-3 w-3" /> SMS Thread
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-emerald-600 font-semibold">{initialThread.conversation.status.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="shadow-sm">Assign</Button>
                    <Button variant="secondary" size="sm" className="shadow-sm">Resolve</Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 bg-slate-50">
                  <div className="px-8 py-8 space-y-6">
                    {initialThread.messages.map((m) => {
                      const isInbound = m.direction === "inbound";
                      return (
                        <div key={m.id} className={`flex gap-4 max-w-[85%] ${isInbound ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}>
                          <Avatar className="h-8 w-8 mt-1 shrink-0 shadow-sm border border-slate-200">
                            <ZoruAvatarFallback className={isInbound ? "bg-indigo-100 text-indigo-700" : "bg-slate-800 text-white"}>
                              {isInbound ? m.from.slice(0, 1).toUpperCase() : "Me"}
                            </ZoruAvatarFallback>
                          </Avatar>
                          <div className={`flex flex-col gap-1.5 ${isInbound ? 'items-start' : 'items-end'}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {isInbound ? m.from : "You"}
                              </span>
                              <Badge variant="outline" className="text-[9px] font-mono shadow-sm bg-white border-slate-200 text-slate-400 py-0 px-1.5">
                                {new Date(m.createdAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Badge>
                            </div>
                            <div className={`p-4 rounded-2xl shadow-sm text-[15px] leading-relaxed ${isInbound ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm' : 'bg-slate-900 text-slate-50 border border-slate-800 rounded-tr-sm'}`}>
                              {m.body}
                              {m.mediaIds && m.mediaIds.length > 0 && (
                                <div className="mt-3 flex gap-2 flex-wrap">
                                  {m.mediaIds.map((id, idx) => (
                                    <div key={idx} className="h-24 w-32 bg-slate-200/50 rounded-lg border border-slate-200 flex items-center justify-center flex-col gap-1 backdrop-blur-sm relative overflow-hidden">
                                      <ImageIcon className="h-6 w-6 text-slate-400" />
                                      <span className="text-[10px] font-medium text-slate-500">Media attachment</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-[9px] h-4 font-mono bg-white/50 text-slate-400 border-slate-200">
                                {formatDeliveryStatusLabel(m.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
                
                <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-20">
                  <div className="relative">
                    <textarea 
                      placeholder="Type your premium response here..." 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-32 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent transition-all resize-none shadow-inner"
                      rows={3}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"><Paperclip className="h-4 w-4"/></Button>
                      <Button size="sm" className="h-8 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-md font-medium"><Send className="h-3 w-3 mr-1.5"/> Send</Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-sm">
                  <div className="mx-auto w-16 h-16 bg-slate-200/50 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <MailWarning className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No conversation selected</h3>
                  <p className="text-slate-500 text-sm">Select a conversation from the left pane to view its dense message history.</p>
                </div>
              </div>
            )}
          </ZoruResizablePanel>
        </ZoruResizablePanelGroup>
      </Card>
    </div>
  );
}
