'use client';

/**
 * SabCRM — Sales leaderboard client surface.
 *
 * Three regions:
 *   1. **My scorecard** — the signed-in rep's rank, points, tier, quota
 *      attainment bar, current streak and earned badges.
 *   2. **Leaderboard** — every rep ranked, with medals for the top three,
 *      points, won revenue/count, activities, tier and badge chips.
 *   3. **Contests** — active contests rail + an `edit`-gated editor (create /
 *      update / delete).
 *
 * Data comes from the gated gamification actions; the period segmented control
 * re-queries on change. All UI is 20ui; lucide icons render via `renderIcon`.
 */

import * as React from 'react';
import {
  Trophy,
  Medal,
  Award,
  Flame,
  Target,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Gift,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Progress,
  Avatar,
  Field,
  Input,
  Textarea,
  SegmentedControl,
  Modal,
  Alert,
  Skeleton,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon, type IconProp } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  getLeaderboardTw,
  getMyScorecardTw,
  saveContestTw,
  deleteContestTw,
} from '@/app/actions/sabcrm-gamification.actions';
import type {
  LeaderboardResult,
  Scorecard,
  Contest,
  GamificationPeriod,
  ScoreboardEntry,
  Badge as BadgeDef,
} from '@/lib/sabcrm/gamification.server';

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

const PERIODS: ReadonlyArray<{ value: GamificationPeriod; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat().format(Math.round(Number.isFinite(n) ? n : 0));
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/** Tone for the tier badge derived from its color token. */
function tierTone(color?: string): 'accent' | 'success' | 'warning' | 'info' | 'neutral' {
  switch (color) {
    case 'green':
      return 'success';
    case 'yellow':
    case 'orange':
      return 'warning';
    case 'sky':
    case 'turquoise':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Medal glyph for the top three ranks, else the bare rank number. */
function RankBadge({ rank }: { rank: number }): React.ReactElement {
  const medal =
    rank === 1
      ? { icon: Trophy, color: 'var(--ui20-warning, #d97706)' }
      : rank === 2
        ? { icon: Medal, color: 'var(--ui20-text-secondary, #9ca3af)' }
        : rank === 3
          ? { icon: Award, color: '#b45309' }
          : null;
  if (medal) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center"
        style={{ color: medal.color }}
        aria-label={`Rank ${rank}`}
      >
        {renderIcon(medal.icon, { size: 20 })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center text-[13px] font-semibold text-[var(--st-text-secondary)]"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge chips                                                                 */
/* -------------------------------------------------------------------------- */

function BadgeChips({
  ids,
  catalogue,
}: {
  ids: string[];
  catalogue: BadgeDef[];
}): React.ReactElement | null {
  if (!ids.length) return null;
  const byId = new Map(catalogue.map((b) => [b.id, b]));
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const b = byId.get(id);
        if (!b) return null;
        return (
          <Badge key={id} tone="accent" kind="soft" title={b.label}>
            {b.label}
          </Badge>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Scorecard card                                                             */
/* -------------------------------------------------------------------------- */

function MyScorecard({
  card,
  catalogue,
}: {
  card: Scorecard;
  catalogue: BadgeDef[];
}): React.ReactElement {
  const e = card.entry;
  const at = card.attainment;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your scorecard</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-[var(--st-space-4)]">
        <div className="grid grid-cols-2 gap-[var(--st-space-4)] sm:grid-cols-4">
          <Stat
            label="Rank"
            value={e ? `#${e.rank}` : '—'}
            sub={card.totalReps ? `of ${card.totalReps}` : undefined}
            icon={Trophy}
          />
          <Stat label="Points" value={e ? fmtInt(e.points) : '0'} icon={TrendingUp} />
          <Stat
            label="Won"
            value={e ? fmtInt(e.wonCount) : '0'}
            sub={e ? fmtCurrency(e.wonRevenue) : undefined}
            icon={Target}
          />
          <Stat
            label="Streak"
            value={`${card.streak}d`}
            sub={card.bestStreak ? `best ${card.bestStreak}d` : undefined}
            icon={Flame}
          />
        </div>

        {e?.tier && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--st-text-secondary)]">Tier</span>
            <Badge tone={tierTone(e.tier.color)} kind="solid">
              {e.tier.label}
            </Badge>
          </div>
        )}

        {at && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--st-text-secondary)]">
                Quota · {at.quotaName} ({at.metric})
              </span>
              <span className="font-medium text-[var(--st-text)]">
                {at.metric === 'revenue'
                  ? `${fmtCurrency(at.actual)} / ${fmtCurrency(at.target)}`
                  : `${fmtInt(at.actual)} / ${fmtInt(at.target)}`}{' '}
                ({Math.round(at.ratio * 100)}%)
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, at.percent))}
              tone={at.attained ? 'success' : 'accent'}
              label={`Quota attainment ${Math.round(at.ratio * 100)} percent`}
            />
          </div>
        )}

        {card.earnedBadges.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-[var(--st-text-secondary)]">Badges</span>
            <BadgeChips ids={card.earnedBadges.map((b) => b.id)} catalogue={catalogue} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconProp;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[12px] text-[var(--st-text-secondary)]">
        {renderIcon(icon, { size: 13 })}
        {label}
      </span>
      <span className="text-[20px] font-semibold leading-tight text-[var(--st-text)]">
        {value}
      </span>
      {sub && <span className="text-[11px] text-[var(--st-text-secondary)]">{sub}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Leaderboard rows                                                           */
/* -------------------------------------------------------------------------- */

function LeaderboardRow({
  entry,
  isMe,
  catalogue,
}: {
  entry: ScoreboardEntry;
  isMe: boolean;
  catalogue: BadgeDef[];
}): React.ReactElement {
  return (
    <div
      className="flex items-center gap-[var(--st-space-3)] rounded-[var(--st-radius-md,8px)] border border-[var(--st-border)] px-[var(--st-space-3)] py-[var(--st-space-2)]"
      style={isMe ? { background: 'var(--st-bg-subtle, rgba(99,102,241,0.06))' } : undefined}
    >
      <RankBadge rank={entry.rank} />
      <Avatar name={entry.name} src={entry.image} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-[var(--st-text)]">
            {entry.name}
          </span>
          {isMe && (
            <Badge tone="info" kind="soft">
              You
            </Badge>
          )}
          {entry.tier && (
            <Badge tone={tierTone(entry.tier.color)} kind="soft">
              {entry.tier.label}
            </Badge>
          )}
        </div>
        <span className="text-[12px] text-[var(--st-text-secondary)]">
          {fmtInt(entry.wonCount)} won · {fmtCurrency(entry.wonRevenue)} · {fmtInt(entry.activities)} activities
        </span>
        <div className="mt-1">
          <BadgeChips ids={entry.badges} catalogue={catalogue} />
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[16px] font-semibold text-[var(--st-text)]">
          {fmtInt(entry.points)}
        </span>
        <span className="text-[11px] text-[var(--st-text-secondary)]">pts</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Contest editor                                                             */
/* -------------------------------------------------------------------------- */

interface ContestForm {
  id?: string;
  name: string;
  description: string;
  prize: string;
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: ContestForm = {
  name: '',
  description: '',
  prize: '',
  startsAt: '',
  endsAt: '',
};

function toForm(c: Contest): ContestForm {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    prize: c.prize ?? '',
    startsAt: c.startsAt?.slice(0, 10) ?? '',
    endsAt: c.endsAt?.slice(0, 10) ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function LeaderboardClient(): React.ReactElement {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [period, setPeriod] = React.useState<GamificationPeriod>('month');
  const [board, setBoard] = React.useState<LeaderboardResult | null>(null);
  const [card, setCard] = React.useState<Scorecard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Contest editor state.
  const [editing, setEditing] = React.useState<ContestForm | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bRes, cRes] = await Promise.all([
      getLeaderboardTw({ period }, activeProjectId ?? undefined),
      getMyScorecardTw(period, activeProjectId ?? undefined),
    ]);
    setLoading(false);
    if (!bRes.ok) {
      setError(bRes.error);
      return;
    }
    setBoard(bRes.data);
    setCard(cRes.ok ? cRes.data : null);
  }, [period, activeProjectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveContest(): Promise<void> {
    if (!editing) return;
    setSaving(true);
    const res = await saveContestTw(
      {
        id: editing.id,
        name: editing.name,
        description: editing.description || undefined,
        prize: editing.prize || undefined,
        startsAt: editing.startsAt,
        endsAt: editing.endsAt,
      },
      activeProjectId ?? undefined,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save contest', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Contest saved', tone: 'success' });
    setEditing(null);
    void load();
  }

  async function removeContest(c: Contest): Promise<void> {
    const res = await deleteContestTw(c.id, activeProjectId ?? undefined);
    if (!res.ok) {
      toast({ title: 'Could not delete contest', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Contest deleted', tone: 'success' });
    void load();
  }

  const myId = card?.ownerId ?? null;
  const catalogue = board?.badges ?? [];

  return (
    <div className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Leaderboard</PageTitle>
          <PageDescription>
            Sales rankings, your scorecard, quota attainment and active contests.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <SegmentedControl
            items={PERIODS}
            value={period}
            onChange={setPeriod}
            size="sm"
            aria-label="Leaderboard period"
          />
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setEditing({ ...EMPTY_FORM })}
          >
            New contest
          </Button>
        </PageActions>
      </PageHeader>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="flex flex-col gap-[var(--st-space-4)]">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {card && <MyScorecard card={card} catalogue={catalogue} />}

          <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Reps</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-[var(--st-space-2)]">
                {board && board.entries.length > 0 ? (
                  board.entries.map((e) => (
                    <LeaderboardRow
                      key={e.ownerId}
                      entry={e}
                      isMe={e.ownerId === myId}
                      catalogue={catalogue}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Trophy}
                    title="No rankings yet"
                    description="Close some deals or log calls and meetings to climb the board."
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active contests</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-[var(--st-space-2)]">
                {board && board.contests.length > 0 ? (
                  board.contests.map((c) => (
                    <ContestRow
                      key={c.id}
                      contest={c}
                      onEdit={() => setEditing(toForm(c))}
                      onDelete={() => void removeContest(c)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Gift}
                    size="sm"
                    title="No active contests"
                    description="Run a contest to drive a sprint."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={Plus}
                        onClick={() => setEditing({ ...EMPTY_FORM })}
                      >
                        Create contest
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit contest' : 'New contest'}
        description="Define a time-boxed sales contest for the team."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void saveContest()}
              loading={saving}
              disabled={saving || !editing?.name.trim() || !editing?.startsAt || !editing?.endsAt}
            >
              Save
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-[var(--st-space-3)]">
            <Field label="Name">
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Q3 Closing Sprint"
              />
            </Field>
            <Field label="Prize">
              <Input
                value={editing.prize}
                onChange={(e) => setEditing({ ...editing, prize: e.target.value })}
                placeholder="$500 gift card"
              />
            </Field>
            <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
              <Field label="Starts">
                <Input
                  type="date"
                  value={editing.startsAt}
                  onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="date"
                  value={editing.endsAt}
                  onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={3}
                placeholder="Rules, scope, anything the team should know."
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ContestRow({
  contest,
  onEdit,
  onDelete,
}: {
  contest: Contest;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-[var(--st-radius-md,8px)] border border-[var(--st-border)] px-[var(--st-space-3)] py-[var(--st-space-2)]">
      <span className="mt-0.5 text-[var(--st-text-secondary)]" aria-hidden="true">
        {renderIcon(Gift, { size: 16 })}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
          {contest.name}
        </span>
        <span className="text-[11px] text-[var(--st-text-secondary)]">
          {fmtDate(contest.startsAt)} – {fmtDate(contest.endsAt)}
          {contest.prize ? ` · ${contest.prize}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" iconLeft={Pencil} onClick={onEdit} aria-label="Edit contest" />
        <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={onDelete} aria-label="Delete contest" />
      </div>
    </div>
  );
}
