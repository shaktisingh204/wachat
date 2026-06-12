import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { buildSabsmsWebhookUrls } from "@/lib/sabsms/webhook-urls";

import { ProvidersClient, type ProviderRow, type ProviderCatalogItem } from "./providers-client";

export const dynamic = "force-dynamic";

async function loadProviders(workspaceId: string): Promise<ProviderRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col
    .find({ workspaceId }, { projection: { credentialsCipher: 0 } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    provider: String(d.provider),
    region: (d.region as string | undefined) ?? undefined,
    isDefault: !!d.isDefault,
    status: (d.status as string) ?? "active",
    lastError: (d.lastError as string | undefined) ?? undefined,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ""),
    webhookUrls: d.webhookSecret
      ? buildSabsmsWebhookUrls(String(d.provider), String(d._id), String(d.webhookSecret))
      : null,
  }));
}

const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  { id: "twilio", name: "Twilio", available: true, region: "US/EU/APAC" },
  { id: "telnyx", name: "Telnyx", available: true, region: "US/EU" },
  { id: "msg91", name: "MSG91", available: true, region: "IN" },
  { id: "gupshup", name: "Gupshup", available: true, region: "IN/APAC" },
  { id: "vonage", name: "Vonage (Nexmo)", available: false, region: "Global" },
  { id: "messagebird", name: "MessageBird / Bird", available: false, region: "Global" },
  { id: "plivo", name: "Plivo", available: false, region: "Global" },
  { id: "sinch", name: "Sinch", available: false, region: "Global" },
  { id: "infobip", name: "Infobip", available: false, region: "Global" },
  { id: "aws_sns", name: "AWS SNS", available: false, region: "Global" },
];

export default async function SabsmsProvidersPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadProviders(workspaceId) : [];

  return <ProvidersClient initialRows={rows} catalog={PROVIDER_CATALOG} />;
}
