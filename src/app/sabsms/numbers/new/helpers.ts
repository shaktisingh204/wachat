/**
 * Provisioning wizard — pure helpers.
 *
 * Kept free of `server-only` imports so the unit tests under
 * `./__tests__/wizard.test.ts` can pull them in via `tsx --test`
 * without dragging in Mongo or `next/cache`. The mutation surface lives
 * in `./actions.ts` and re-exports these for the client component.
 */

import type {
  SabsmsNumberType,
  SabsmsProviderId,
} from "@/lib/sabsms/types";

// ─── Domain types ─────────────────────────────────────────────────────────

export type ProvisionCapabilities = {
  sms: boolean;
  mms: boolean;
  rcs: boolean;
  voice: boolean;
};

export interface AvailableNumber {
  e164: string;
  country: string;
  type: SabsmsNumberType;
  monthlyCost: number; // cents
  capabilities: ProvisionCapabilities;
  region?: string;
}

export interface SearchAvailableInput {
  provider: SabsmsProviderId;
  country: string;
  type: SabsmsNumberType;
  pattern?: string;
  capabilities: ProvisionCapabilities;
}

export interface ProvisionInput {
  provider: SabsmsProviderId;
  country: string;
  type: SabsmsNumberType;
  numbers: string[];
  capabilities: ProvisionCapabilities;
  campaignId?: string;
  poolId?: string;
  webhookUrlOverride?: string;
  defaultFooter?: string;
  defaultSenderId?: string;
  useCase: string;
  draft?: boolean;
  monthlyCostEstimate: number;
}

// ─── Provider catalog ─────────────────────────────────────────────────────

export const SUPPORTED_PROVIDERS: SabsmsProviderId[] = ["twilio"];

export const PHASE_7_PROVIDERS: SabsmsProviderId[] = [
  "vonage",
  "messagebird",
  "plivo",
  "sinch",
  "infobip",
  "aws_sns",
  "telnyx",
  "msg91",
  "gupshup",
  "textlocal",
  "kaleyra",
  "karix",
];

export function providerLabel(id: SabsmsProviderId): string {
  const map: Record<SabsmsProviderId, string> = {
    twilio: "Twilio",
    vonage: "Vonage",
    messagebird: "MessageBird",
    plivo: "Plivo",
    sinch: "Sinch",
    infobip: "Infobip",
    aws_sns: "AWS SNS",
    telnyx: "Telnyx",
    msg91: "MSG91",
    gupshup: "Gupshup",
    textlocal: "Textlocal",
    kaleyra: "Kaleyra",
    karix: "Karix",
  };
  return map[id];
}

export function listProviders(): Array<{
  id: SabsmsProviderId;
  label: string;
  available: boolean;
  phase: "phase-1" | "phase-7";
}> {
  const supported = SUPPORTED_PROVIDERS.map((id) => ({
    id,
    label: providerLabel(id),
    available: true,
    phase: "phase-1" as const,
  }));
  const future = PHASE_7_PROVIDERS.map((id) => ({
    id,
    label: providerLabel(id),
    available: false,
    phase: "phase-7" as const,
  }));
  return [...supported, ...future];
}

// ─── Validation + cost cap + compliance ──────────────────────────────────

export const COST_CAP_USD_CENTS = 100_00;

export function validateProvisionInput(
  input: Partial<ProvisionInput>,
): Array<{ field: keyof ProvisionInput | "_"; message: string }> {
  const issues: Array<{
    field: keyof ProvisionInput | "_";
    message: string;
  }> = [];

  if (!input.provider) {
    issues.push({ field: "provider", message: "Provider is required" });
  } else if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
    issues.push({
      field: "provider",
      message: `${providerLabel(input.provider)} is not available yet (Phase 7)`,
    });
  }

  if (!input.country || input.country.length !== 2) {
    issues.push({
      field: "country",
      message: "Country (ISO-3166-1 alpha-2) is required",
    });
  }

  if (!input.type) {
    issues.push({ field: "type", message: "Number type is required" });
  }

  if (!input.numbers || input.numbers.length === 0) {
    issues.push({ field: "numbers", message: "Pick at least one number" });
  }

  if (!input.useCase || !input.useCase.trim()) {
    issues.push({
      field: "useCase",
      message: "Use-case attestation is required (TCPA / 10DLC)",
    });
  }

  if (
    input.type === "alphanumeric" &&
    (!input.defaultSenderId || !input.defaultSenderId.trim())
  ) {
    issues.push({
      field: "defaultSenderId",
      message: "Alphanumeric type requires a sender id",
    });
  }

  if (input.webhookUrlOverride) {
    try {
      const u = new URL(input.webhookUrlOverride);
      if (!/^https?:$/.test(u.protocol)) {
        issues.push({
          field: "webhookUrlOverride",
          message: "Webhook URL must be http(s)",
        });
      }
    } catch {
      issues.push({
        field: "webhookUrlOverride",
        message: "Webhook URL is not a valid URL",
      });
    }
  }

  return issues;
}

export function exceedsCostCap(monthlyCostEstimateCents: number): boolean {
  return monthlyCostEstimateCents > COST_CAP_USD_CENTS;
}

export function isComplianceRequired(input: {
  country: string;
  type: SabsmsNumberType;
}): { required: boolean; key: "10dlc" | "dlt" | null } {
  if (input.country === "US" && input.type === "longcode") {
    return { required: true, key: "10dlc" };
  }
  if (input.country === "IN" && input.type === "longcode") {
    return { required: true, key: "dlt" };
  }
  return { required: false, key: null };
}

// ─── Mock data (Phase 1) ──────────────────────────────────────────────────

export function generateMockAvailableNumbers(
  input: SearchAvailableInput,
): AvailableNumber[] {
  const prefix =
    input.country === "US"
      ? "+1"
      : input.country === "IN"
        ? "+91"
        : input.country === "GB"
          ? "+44"
          : "+99";
  const areaCodeSeed =
    (input.pattern ?? "0").replace(/\D+/g, "").slice(0, 3) || "415";
  const monthlyCost =
    input.type === "tollfree"
      ? 200
      : input.type === "shortcode"
        ? 50_000
        : input.type === "alphanumeric"
          ? 0
          : 100;

  const lines: AvailableNumber[] = [];
  for (let i = 0; i < 10; i++) {
    const suffix = String(1000000 + i * 137 + areaCodeSeed.length).slice(-7);
    lines.push({
      e164: `${prefix}${areaCodeSeed}${suffix}`,
      country: input.country.toUpperCase(),
      type: input.type,
      monthlyCost,
      capabilities: input.capabilities,
      region: input.pattern ? `pattern:${input.pattern}` : undefined,
    });
  }
  return lines;
}
