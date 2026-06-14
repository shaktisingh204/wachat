import {
  listWidgetInboxes,
  getWidgetConfig,
} from "@/app/actions/sabchat-widget-config.actions";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/sabchat/widget-config";

import { WidgetStudioClient } from "./_components/widget-studio-client";

export const dynamic = "force-dynamic";

export default async function SabchatWidgetPage() {
  const inboxes = await listWidgetInboxes();
  const first = inboxes[0];
  const initial = first ? await getWidgetConfig(first.id) : null;

  return (
    <WidgetStudioClient
      inboxes={inboxes}
      initialInboxId={first?.id ?? null}
      initialConfig={initial?.config ?? DEFAULT_WIDGET_CONFIG}
    />
  );
}
