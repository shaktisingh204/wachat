export type SabflowBlock = {
  id: string;
  name: string;
  type: "trigger" | "action";
  category: "messaging" | "logic" | "data" | "compliance";
  status: "ga" | "beta" | "deprecated";
  creditCost: number;
  usageCount: number;
  compatibility: {
    wachat: boolean;
    sabwa: boolean;
    crm: boolean;
  };
  description: string;
  schema: string;
  exampleWorkflow: string;
  changelog: string;
  copySnippet: string;
  dependencies: string[];
  icon: string;
};

export const MOCK_BLOCKS: SabflowBlock[] = [
  {
    id: "blk_send_sms",
    name: "Send SMS",
    type: "action",
    category: "messaging",
    status: "ga",
    creditCost: 1,
    usageCount: 125000,
    compatibility: { wachat: false, sabwa: true, crm: true },
    description: "Sends an outbound SMS to a target number.",
    schema: "{\n  \"to\": \"string\",\n  \"body\": \"string\",\n  \"senderId\": \"string?\"\n}",
    exampleWorkflow: "Trigger: New CRM Lead -> Action: Send SMS",
    changelog: "v1.1: Added senderId override.",
    copySnippet: "<Block id=\"blk_send_sms\" to=\"{{contact.phone}}\" body=\"Hello!\" />",
    dependencies: ["provider_twilio", "compliance_10dlc"],
    icon: "MessageSquare",
  },
  {
    id: "blk_inbound_sms",
    name: "Inbound SMS Received",
    type: "trigger",
    category: "messaging",
    status: "ga",
    creditCost: 0,
    usageCount: 84000,
    compatibility: { wachat: true, sabwa: true, crm: false },
    description: "Fires when an inbound SMS matches your number.",
    schema: "{\n  \"from\": \"string\",\n  \"body\": \"string\",\n  \"messageId\": \"string\"\n}",
    exampleWorkflow: "Trigger: Inbound SMS Received -> Action: Add to Segment",
    changelog: "v1.0: Initial release.",
    copySnippet: "<Trigger type=\"inbound_sms\" />",
    dependencies: [],
    icon: "Inbox",
  },
  {
    id: "blk_check_consent",
    name: "Check Consent",
    type: "action",
    category: "compliance",
    status: "beta",
    creditCost: 0.1,
    usageCount: 3200,
    compatibility: { wachat: false, sabwa: false, crm: true },
    description: "Verifies if the contact has active consent before sending.",
    schema: "{\n  \"phone\": \"string\"\n}",
    exampleWorkflow: "Trigger: Scheduled -> Action: Check Consent -> Branch: If True -> Send SMS",
    changelog: "v0.9: Added support for double opt-in checks.",
    copySnippet: "<Block id=\"blk_check_consent\" phone=\"{{contact.phone}}\" />",
    dependencies: ["db_consent"],
    icon: "ShieldCheck",
  },
  {
    id: "blk_delay",
    name: "Time Delay",
    type: "action",
    category: "logic",
    status: "deprecated",
    creditCost: 0,
    usageCount: 450,
    compatibility: { wachat: true, sabwa: true, crm: true },
    description: "Pauses the flow for a set duration.",
    schema: "{\n  \"durationSeconds\": \"number\"\n}",
    exampleWorkflow: "Action: Send SMS -> Action: Time Delay (86400) -> Action: Send Follow-up",
    changelog: "v1.0: Deprecated in favor of Smart Wait.",
    copySnippet: "<Block id=\"blk_delay\" durationSeconds={3600} />",
    dependencies: [],
    icon: "Clock",
  }
];

export type SabflowTemplate = {
  id: string;
  name: string;
  description: string;
  installGuide: string;
  testData: string;
  auditInfo: string;
};

export const MOCK_TEMPLATES: SabflowTemplate[] = [
  {
    id: "tpl_optin",
    name: "Double Opt-in Flow",
    description: "Automatically handles STOP/START keywords and maintains consent ledger.",
    installGuide: "1. Click Add to SabFlow. 2. Select your compliance region. 3. Enable.",
    testData: "{\"phone\": \"+1234567890\", \"keyword\": \"START\"}",
    auditInfo: "Last audited: 2026-05-20. Passed TCPA review.",
  },
  {
    id: "tpl_reminder",
    name: "Appointment Reminder",
    description: "Sends a 24-hour reminder SMS before a scheduled CRM event.",
    installGuide: "1. Connect CRM block. 2. Map 'appointment_date'. 3. Activate.",
    testData: "{\"event_id\": \"evt_987\", \"appointment_date\": \"2026-05-25T10:00:00Z\"}",
    auditInfo: "Last audited: 2026-04-15. Privacy safe.",
  }
];
