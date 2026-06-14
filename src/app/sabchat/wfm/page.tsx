import { redirect } from "next/navigation";

import {
  Card,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";
import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";
import { getForecast } from "@/app/actions/sabchat-wfm.actions";

export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function cellColor(agents: number, peak: number): string {
  if (agents <= 0 || peak <= 0) return "transparent";
  const t = Math.min(1, agents / peak);
  // emerald → amber → red ramp by intensity
  const hue = 150 - Math.round(t * 150); // 150 (green) → 0 (red)
  return `hsl(${hue} 70% 45% / ${0.25 + t * 0.55})`;
}

export default async function SabchatWfmPage() {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) redirect("/sabchat/projects");

  const forecast = await getForecast({ weeks: 4 });

  // Build a 7×24 grid of recommended agents.
  const grid: number[][] = DAYS.map(() => HOURS.map(() => 0));
  const vol: number[][] = DAYS.map(() => HOURS.map(() => 0));
  for (const s of forecast?.slots ?? []) {
    if (grid[s.dayOfWeek]) {
      grid[s.dayOfWeek][s.hour] = s.recommendedAgents;
      vol[s.dayOfWeek][s.hour] = s.avgVolume;
    }
  }
  const peak = forecast?.peakAgents ?? 0;
  const busiest = (forecast?.slots ?? []).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Workforce forecast</PageTitle>
          <PageDescription>
            Expected inbound volume by hour-of-week (last {forecast?.weeks ?? 4}{" "}
            weeks) and the agents you&apos;d need to keep up — at{" "}
            {forecast?.targetPerAgentPerHour ?? 6} conversations / agent / hour.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Peak staffing
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">{peak} agents</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Conversations analyzed
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">
            {forecast?.totalConversations ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Window
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">
            {forecast?.weeks ?? 4} wks
          </p>
        </Card>
      </div>

      {/* Heatmap */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        Recommended agents · by hour-of-week
      </h2>
      <Card className="overflow-x-auto p-3">
        {(forecast?.totalConversations ?? 0) === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--st-text-secondary)]">
            Not enough conversation history yet to forecast.
          </p>
        ) : (
          <table className="border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[var(--st-bg)] px-1 py-0.5 text-left text-[var(--st-text-secondary)]"></th>
                {HOURS.map((h) => (
                  <th key={h} className="px-0.5 py-0.5 font-normal text-[var(--st-text-secondary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => (
                <tr key={d}>
                  <td className="sticky left-0 bg-[var(--st-bg)] px-1 py-0.5 font-medium text-[var(--st-text-secondary)]">
                    {d}
                  </td>
                  {HOURS.map((h) => (
                    <td
                      key={h}
                      title={`${d} ${h}:00 — ${vol[di][h].toFixed(1)} convs → ${grid[di][h]} agents`}
                      className="h-5 w-5 rounded-[2px] text-center text-[var(--st-text)]"
                      style={{ background: cellColor(grid[di][h], peak) }}
                    >
                      {grid[di][h] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Busiest slots */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">Busiest hours</h2>
      <Card className="p-0">
        {busiest.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No data.</p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {busiest.map((s, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-[var(--st-text)]">
                  {DAYS[s.dayOfWeek]} · {String(s.hour).padStart(2, "0")}:00
                </span>
                <span className="text-[var(--st-text-secondary)]">
                  {s.avgVolume.toFixed(1)} convs/hr · {s.recommendedAgents} agents
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
