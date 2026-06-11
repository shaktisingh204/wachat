"use client";

import {
  Headphones,
  Home,
  Layers,
  MonitorSmartphone,
  Phone,
  PhoneCall,
  Plus,
  ScreenShare,
  Voicemail,
  Workflow,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABVOICE_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabvoice",
  heading: "SabVoice",
  caption: "Cloud PBX & calling",
  build: (p) => [
    {
      id: "voice-calling",
      label: "Calling",
      items: [
        leaf("overview", "Overview", "/dashboard/sabvoice", Home, p, { exact: true }),
        leaf("agent-dashboard", "Agent dashboard", "/dashboard/sabvoice/agent-dashboard", Headphones, p),
        leaf("calls", "Call log", "/dashboard/sabvoice/calls", PhoneCall, p),
        leaf("voicemail", "Voicemail", "/dashboard/sabvoice/voicemail", Voicemail, p),
      ],
    },
    {
      id: "voice-routing",
      label: "Routing",
      items: [
        leaf("dids", "Phone numbers", "/dashboard/sabvoice/dids", Phone, p),
        leaf("ivr", "IVR flows", "/dashboard/sabvoice/ivr", Workflow, p),
        leaf("queues", "Call queues", "/dashboard/sabvoice/queues", Layers, p),
      ],
    },
    {
      id: "voice-assist",
      label: "Remote assist",
      items: [
        leaf("assist", "Sessions", "/dashboard/sabvoice/assist", ScreenShare, p),
        leaf("assist-new", "New session", "/dashboard/sabvoice/assist/new", Plus, p),
        leaf("assist-devices", "Devices", "/dashboard/sabvoice/assist/devices", MonitorSmartphone, p),
      ],
    },
  ],
};
