import 'server-only';

/**
 * Server-side analytics loader for the SabBigin dashboards page.
 *
 * Reads `crm_deals` / `crm_contacts` / `crm_activities` directly (tenant-scoped
 * by the session `userId`) and folds in the tenant's pipelines so each chart can
 * label deals by their pipeline. Everything is computed in one round-trip so the
 * page renders without a client-side data fetch.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSabbiginConfig } from '@/app/actions/sabbigin.actions';
import { sabbiginCurrency } from '@/lib/sabbigin/config-helpers';

export interface DashboardKpis {
  openDeals: number;
  openValue: number;
  wonThisMonthValue: number;
  contactsThisMonth: number;
  activitiesCompleted: number;
}

export interface StageDatum {
  /** Stage label. */
  stage: string;
  /** Count of open deals sitting in this stage. */
  count: number;
  /** Summed open value in this stage. */
  value: number;
}

export interface MonthDatum {
  /** Short month label, e.g. "Jan". */
  month: string;
  /** Deals created in that calendar month. */
  deals: number;
}

export interface PipelineDatum {
  /** Pipeline label. */
  name: string;
  /** Count of deals attributed to this pipeline. */
  deals: number;
}

export interface DashboardData {
  hasAnyData: boolean;
  currency: string;
  kpis: DashboardKpis;
  stages: StageDatum[];
  months: MonthDatum[];
  pipelines: PipelineDatum[];
}

const WON_RE = /(won|closed won|complete)/i;
const LOST_RE = /(lost|dead|cancel)/i;

function isWon(stageOrStatus: string): boolean {
  return WON_RE.test(stageOrStatus) && !LOST_RE.test(stageOrStatus);
}

function emptyData(): DashboardData {
  return {
    hasAnyData: false,
    currency: 'INR',
    kpis: {
      openDeals: 0,
      openValue: 0,
      wonThisMonthValue: 0,
      contactsThisMonth: 0,
      activitiesCompleted: 0,
    },
    stages: [],
    months: [],
    pipelines: [],
  };
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface DealLite {
  value?: number;
  stage?: string;
  status?: string;
  pipelineId?: string | ObjectId | null;
  createdAt?: string | Date;
}

export async function loadDashboardData(): Promise<DashboardData> {
  const session = await getSession();
  if (!session?.user?._id) return emptyData();

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Inclusive start of the 6-month window (this month minus 5).
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [pipelines, config, deals, contactsThisMonth, activitiesCompleted] =
      await Promise.all([
        getCrmPipelines(),
        getSabbiginConfig(),
        db
          .collection<DealLite>('crm_deals')
          .find({ userId } as Record<string, unknown>)
          .project({ value: 1, stage: 1, status: 1, pipelineId: 1, createdAt: 1 })
          .toArray(),
        db
          .collection('crm_contacts')
          .countDocuments({ userId, createdAt: { $gte: monthStart } }),
        db.collection('crm_activities').countDocuments({
          userId,
          status: { $in: ['done', 'completed'] },
        }),
      ]);

    const currency = sabbiginCurrency(config);

    // --- Pipeline name lookup -------------------------------------------------
    const pipelineNameById = new Map<string, string>();
    for (const p of pipelines) {
      pipelineNameById.set(String(p.id), p.name);
    }

    // --- KPI + stage + month + pipeline aggregation over one pass ------------
    const stageAgg = new Map<string, { count: number; value: number }>();
    const monthAgg = new Map<string, number>();
    const pipelineAgg = new Map<string, number>();

    // Seed the 6-month window so empty months still render as 0.
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthAgg.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }

    let openDeals = 0;
    let openValue = 0;
    let wonThisMonthValue = 0;

    for (const deal of deals as DealLite[]) {
      const value = typeof deal.value === 'number' ? deal.value : 0;
      const stage = (deal.stage ?? '').trim();
      const status = (deal.status ?? '').trim();
      const won = isWon(status) || isWon(stage);
      const lost = LOST_RE.test(status) || LOST_RE.test(stage);
      const created = deal.createdAt ? new Date(deal.createdAt) : null;

      // KPIs
      if (!won && !lost) {
        openDeals += 1;
        openValue += value;
        const label = stage || 'Unstaged';
        const cur = stageAgg.get(label) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += value;
        stageAgg.set(label, cur);
      }
      if (won && created && created >= monthStart) {
        wonThisMonthValue += value;
      }

      // Deals-per-month over the trailing window
      if (created && created >= windowStart) {
        const key = `${created.getFullYear()}-${created.getMonth()}`;
        if (monthAgg.has(key)) monthAgg.set(key, (monthAgg.get(key) ?? 0) + 1);
      }

      // Deals by pipeline
      const pid = deal.pipelineId ? String(deal.pipelineId) : '';
      const pname = pipelineNameById.get(pid) ?? (pid ? 'Other' : 'No pipeline');
      pipelineAgg.set(pname, (pipelineAgg.get(pname) ?? 0) + 1);
    }

    // Order stages by the pipeline's own stage order when we can, else by value.
    const stageOrder: string[] = [];
    for (const p of pipelines) {
      for (const s of p.stages ?? []) {
        if (!stageOrder.includes(s.name)) stageOrder.push(s.name);
      }
    }
    const stages: StageDatum[] = [...stageAgg.entries()]
      .map(([stage, v]) => ({ stage, count: v.count, value: v.value }))
      .sort((a, b) => {
        const ai = stageOrder.indexOf(a.stage);
        const bi = stageOrder.indexOf(b.stage);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return b.value - a.value;
      });

    const months: MonthDatum[] = [...monthAgg.entries()].map(([key, deals]) => {
      const monthIdx = Number(key.split('-')[1]);
      return { month: MONTH_LABELS[monthIdx] ?? key, deals };
    });

    const pipelinesData: PipelineDatum[] = [...pipelineAgg.entries()]
      .map(([name, deals]) => ({ name, deals }))
      .sort((a, b) => b.deals - a.deals)
      .slice(0, 6);

    const hasAnyData =
      deals.length > 0 || contactsThisMonth > 0 || activitiesCompleted > 0;

    return {
      hasAnyData,
      currency,
      kpis: {
        openDeals,
        openValue,
        wonThisMonthValue,
        contactsThisMonth,
        activitiesCompleted,
      },
      stages,
      months,
      pipelines: pipelinesData,
    };
  } catch (e) {
    console.error('[loadDashboardData] failed:', e);
    return emptyData();
  }
}
