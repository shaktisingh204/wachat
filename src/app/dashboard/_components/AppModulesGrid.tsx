"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  MessageSquare,
  Workflow,
  Briefcase,
  Mail,
  Smartphone,
  Bot,
  Globe,
  LayoutTemplate,
  ShoppingBag,
  Link as LinkIcon,
  QrCode,
  Megaphone,
  Earth,
  Users,
  Bell,
  MoreHorizontal,
  Settings
} from "lucide-react";
import { 
  Button,
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuCheckboxItem
} from "@/components/zoruui";
import { ModuleTile } from "./shared";
import { compact, curr } from "./utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableModuleTile({ id, moduleData }: { id: string, moduleData: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ModuleTile {...moduleData} />
    </div>
  );
}

export function AppModulesGrid({ data, derived }: { data: any, derived: any }) {
  const router = useRouter();
  const { stats, velocity, unreadNotifications, currency } = data;

  const defaultModules = [
    {
      id: "wachat-broadcasts",
      icon: <Send />,
      name: "Wachat Broadcasts",
      primary: `${compact(stats.totalMessages)} sent`,
      secondary: `${compact(stats.totalCampaigns)} campaigns · ${derived?.deliveryRate ?? 0}% delivered`,
      href: "/wachat/broadcasts",
      status: stats.totalSent > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "wachat-chat",
      icon: <MessageSquare />,
      name: "Wachat Chat",
      primary: compact(stats.totalContacts),
      secondary: `contacts · +${velocity.contactsLast7d} this week`,
      href: "/wachat/chat",
      status: stats.totalContacts > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "sabflow",
      icon: <Workflow />,
      name: "SabFlow",
      primary: `${stats.activeFlows}/${stats.totalFlows}`,
      secondary: `${compact(stats.totalFlowExecutions)} executions`,
      href: "/dashboard/sabflow/flow-builder",
      status: stats.activeFlows > 0 ? ("ok" as const) : stats.totalFlows > 0 ? ("warn" as const) : ("off" as const)
    },
    {
      id: "crm",
      icon: <Briefcase />,
      name: "CRM Pipeline",
      primary: curr(stats.pipelineValue, currency),
      secondary: `${stats.totalDeals} deals · ${compact(stats.totalLeads)} leads`,
      href: "/dashboard/crm/sales-crm/leads",
      status: stats.totalDeals > 0 ? ("ok" as const) : stats.totalLeads > 0 ? ("warn" as const) : ("off" as const)
    },
    {
      id: "email",
      icon: <Mail />,
      name: "Email",
      primary: compact(stats.totalEmailCampaigns),
      secondary: `${compact(stats.totalEmailContacts)} contacts`,
      href: "/dashboard/email",
      status: stats.totalEmailCampaigns > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "sabsms",
      icon: <Smartphone />,
      name: "SabSMS",
      primary: compact(stats.totalSmsSent),
      secondary: `${derived?.smsDeliveryRate ?? 0}% delivered`,
      href: "/sabsms",
      status: stats.totalSmsSent > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "sabchat",
      icon: <Bot />,
      name: "SabChat",
      primary: compact(stats.totalSabChatSessions),
      secondary: "AI chatbot sessions",
      href: "/dashboard/sabchat",
      status: stats.totalSabChatSessions > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "seo",
      icon: <Globe />,
      name: "SEO Suite",
      primary: `${stats.totalSeoProjects} ${stats.totalSeoProjects === 1 ? "site" : "sites"}`,
      secondary: `${compact(stats.totalSeoAudits)} audits · ${compact(stats.totalSeoKeywords)} keywords`,
      href: "/dashboard/seo",
      status: stats.totalSeoAudits > 0 ? ("ok" as const) : stats.totalSeoProjects > 0 ? ("warn" as const) : ("off" as const)
    },
    {
      id: "templates",
      icon: <LayoutTemplate />,
      name: "Templates",
      primary: compact(stats.totalTemplates),
      secondary: `${compact(stats.totalLibraryTemplates)} in library`,
      href: "/wachat/templates",
      status: stats.totalTemplates > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "ecomm",
      icon: <ShoppingBag />,
      name: "E-commerce",
      primary: compact(stats.totalEcommOrders),
      secondary: `${compact(stats.totalEcommProducts)} products`,
      href: "/dashboard/shop",
      status: stats.totalEcommOrders > 0 ? ("ok" as const) : stats.totalEcommProducts > 0 ? ("warn" as const) : ("off" as const)
    },
    {
      id: "shortener",
      icon: <LinkIcon />,
      name: "URL Shortener",
      primary: compact(stats.totalShortUrls),
      secondary: "short links created",
      href: "/dashboard/url-shortener",
      status: stats.totalShortUrls > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "qrcode",
      icon: <QrCode />,
      name: "QR Codes",
      primary: compact(stats.totalQrCodes),
      secondary: "codes generated",
      href: "/dashboard/qr-code-maker",
      status: stats.totalQrCodes > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "facebook",
      icon: <Megaphone />,
      name: "Facebook Suite",
      primary: compact(stats.totalFacebookBroadcasts),
      secondary: `${compact(stats.totalFacebookSubscribers)} subscribers`,
      href: "/dashboard/facebook/all-projects",
      status: stats.totalFacebookBroadcasts > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "website",
      icon: <Earth />,
      name: "Website Builder",
      primary: compact(stats.totalSites),
      secondary: "published sites",
      href: "/dashboard/website-builder",
      status: stats.totalSites > 0 ? ("ok" as const) : ("off" as const)
    },
    {
      id: "team",
      icon: <Users />,
      name: "Team",
      primary: compact(stats.totalTeamMessages),
      secondary: stats.totalPendingInvitations > 0 ? `${stats.totalPendingInvitations} pending invites` : "team messages",
      href: "/dashboard/team",
      status: stats.totalPendingInvitations > 0 ? ("warn" as const) : ("ok" as const)
    },
    {
      id: "notifications",
      icon: <Bell />,
      name: "Notifications",
      primary: compact(unreadNotifications?.length || 0),
      secondary: unreadNotifications?.length > 0 ? "unread" : "all caught up",
      href: "/dashboard/notifications",
      status: unreadNotifications?.length > 0 ? ("warn" as const) : ("ok" as const)
    }
  ];

  const [modules, setModules] = useState(defaultModules);
  
  const [visibleModules, setVisibleModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    defaultModules.forEach(m => { initial[m.id] = true; });
    return initial;
  });

  const toggleModule = (id: string) => {
    setVisibleModules(prev => ({
      ...prev,
      [id]: prev[id] === false ? true : false
    }));
  };

  const visibleModuleList = modules.filter(m => visibleModules[m.id] !== false);

  useEffect(() => {
    const savedOrder = localStorage.getItem("zoru-dashboard-modules");
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const orderedModules = [];
        const remaining = [...defaultModules];

        for (const id of orderIds) {
          const foundIdx = remaining.findIndex(m => m.id === id);
          if (foundIdx !== -1) {
            orderedModules.push(remaining[foundIdx]);
            remaining.splice(foundIdx, 1);
          }
        }
        
        setModules([...orderedModules, ...remaining]);
      } catch (e) {}
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArr = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("zoru-dashboard-modules", JSON.stringify(newArr.map(m => m.id)));
        return newArr;
      });
    }
  }

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
            All Apps
          </h2>
          <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
            Live counts across every SabNode module ·{" "}
            {compact(stats.totalActivityLogs7d)} actions this week
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Customize Layout">
                <Settings className="opacity-60" /> Layout
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-56">
              <ZoruDropdownMenuLabel>Customize Apps</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              {defaultModules.map((m) => (
                <ZoruDropdownMenuCheckboxItem
                  key={m.id}
                  checked={visibleModules[m.id] !== false}
                  onCheckedChange={() => toggleModule(m.id)}
                >
                  {m.name}
                </ZoruDropdownMenuCheckboxItem>
              ))}
            </ZoruDropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/wachat/integrations")}
          >
            Integrations
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="More"
            onClick={() => router.push("/dashboard/settings")}
          >
            <MoreHorizontal />
          </Button>
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SortableContext items={visibleModuleList.map(m => m.id)} strategy={rectSortingStrategy}>
            {visibleModuleList.map((m) => (
              <SortableModuleTile key={m.id} id={m.id} moduleData={m} />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </section>
  );
}
