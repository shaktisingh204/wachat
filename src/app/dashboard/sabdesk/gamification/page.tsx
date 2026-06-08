'use client';

import React, { useState } from 'react';
import {
  Trophy, Medal, Zap, Target, Crown,
  TrendingUp, Activity, Clock, Shield,
  ChevronRight, Filter, Search, Flame,
  CheckCircle,
  ShoppingCart, Coins, ArrowUpRight, ArrowRight,
  Heart, Sparkles, Gem,
  Hexagon, Briefcase, Lock,
  Users, LayoutDashboard,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  StatCard,
  Badge,
  Progress,
  Field,
  Input,
  Separator,
  EmptyState,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import type { BadgeTone } from '@/components/sabcrm/20ui';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// MOCK DATA
// ============================================================================

const LEADERBOARD_DATA = [
  { id: '1', name: 'Alex Chen', role: 'Support Specialist', points: 14520, tier: 'Diamond', change: '+2', avatar: 'https://i.pravatar.cc/150?u=1', badges: ['Speed Demon', 'Empathy Guru'], csat: 99.2, tickets: 432 },
  { id: '2', name: 'Sarah Miller', role: 'Technical Lead', points: 13950, tier: 'Diamond', change: '-1', avatar: 'https://i.pravatar.cc/150?u=2', badges: ['Bug Smasher', 'Mentor'], csat: 98.5, tickets: 385 },
  { id: '3', name: 'James Wilson', role: 'Customer Success', points: 12840, tier: 'Platinum', change: '0', avatar: 'https://i.pravatar.cc/150?u=3', badges: ['Retention King'], csat: 97.8, tickets: 412 },
  { id: '4', name: 'Elena Rodriguez', role: 'Support Agent', points: 11200, tier: 'Platinum', change: '+5', avatar: 'https://i.pravatar.cc/150?u=4', badges: ['Night Owl'], csat: 96.5, tickets: 350 },
  { id: '5', name: 'David Kim', role: 'Tier 2 Support', points: 10500, tier: 'Gold', change: '-2', avatar: 'https://i.pravatar.cc/150?u=5', badges: ['Problem Solver'], csat: 95.9, tickets: 290 },
  { id: '6', name: 'Maria Garcia', role: 'Onboarding Spec.', points: 9800, tier: 'Gold', change: '+1', avatar: 'https://i.pravatar.cc/150?u=6', badges: ['First Impression'], csat: 98.1, tickets: 210 },
  { id: '7', name: 'Tom Hardy', role: 'Support Agent', points: 9200, tier: 'Gold', change: '-1', avatar: 'https://i.pravatar.cc/150?u=7', badges: ['Consistent'], csat: 94.5, tickets: 320 },
  { id: '8', name: 'Rachel Green', role: 'Support Agent', points: 8750, tier: 'Silver', change: '0', avatar: 'https://i.pravatar.cc/150?u=8', badges: ['Friendly Voice'], csat: 93.2, tickets: 280 },
  { id: '9', name: 'Chris Evans', role: 'Technical Support', points: 8100, tier: 'Silver', change: '+3', avatar: 'https://i.pravatar.cc/150?u=9', badges: ['Tech Whiz'], csat: 92.8, tickets: 195 },
  { id: '10', name: 'Anna Lee', role: 'Support Agent', points: 7500, tier: 'Bronze', change: '-1', avatar: 'https://i.pravatar.cc/150?u=10', badges: ['Rookie of the Month'], csat: 91.5, tickets: 150 },
];

type BadgeRarity = 'Legendary' | 'Epic' | 'Rare' | 'Uncommon';

interface BadgeRecord {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  progress: number;
  unlocked: boolean;
  rarity: BadgeRarity;
}

const BADGES_DATA: BadgeRecord[] = [
  { id: 'b1', name: 'Speed Demon', description: 'Resolve 100 tickets with first response under 5m', icon: Zap, progress: 100, unlocked: true, rarity: 'Epic' },
  { id: 'b2', name: 'Empathy Guru', description: 'Receive 50 5-star CSAT ratings mentioning "helpful"', icon: Heart, progress: 100, unlocked: true, rarity: 'Legendary' },
  { id: 'b3', name: 'Bug Smasher', description: 'Identify and escalate 20 confirmed platform bugs', icon: Shield, progress: 85, unlocked: false, rarity: 'Rare' },
  { id: 'b4', name: 'Night Owl', description: 'Resolve 500 tickets between 10PM and 6AM', icon: Clock, progress: 42, unlocked: false, rarity: 'Uncommon' },
  { id: 'b5', name: 'Mentor', description: 'Help onboard 5 new support agents', icon: Users, progress: 100, unlocked: true, rarity: 'Epic' },
  { id: 'b6', name: 'Knowledge Keeper', description: 'Create or update 50 KB articles', icon: Briefcase, progress: 12, unlocked: false, rarity: 'Rare' },
  { id: 'b7', name: 'Unbreakable', description: 'Maintain a 30-day login streak', icon: Flame, progress: 28, unlocked: false, rarity: 'Epic' },
  { id: 'b8', name: 'Zen Master', description: 'De-escalate 10 angry customer interactions successfully', icon: Target, progress: 9, unlocked: false, rarity: 'Legendary' },
];

const QUESTS_DATA = {
  daily: [
    { id: 'qd1', title: 'Inbox Zero', description: 'Clear all assigned tickets before EOD', reward: 150, type: 'Points', progress: 8, total: 10, status: 'in-progress' },
    { id: 'qd2', title: 'Lightning Fast', description: 'Maintain average response time under 10m today', reward: 100, type: 'Points', progress: 1, total: 1, status: 'completed' },
    { id: 'qd3', title: 'Knowledge Sharer', description: 'Link 3 KB articles in your responses', reward: 50, type: 'Points', progress: 1, total: 3, status: 'in-progress' },
  ],
  weekly: [
    { id: 'qw1', title: 'CSAT Champion', description: 'Achieve 95%+ CSAT on minimum 50 tickets', reward: 500, type: 'Points', progress: 42, total: 50, status: 'in-progress' },
    { id: 'qw2', title: 'Bug Hunter', description: 'Verify and escalate 5 legitimate bug reports', reward: 300, type: 'Points', progress: 5, total: 5, status: 'completed' },
    { id: 'qw3', title: 'Team Player', description: 'Leave 10 constructive internal notes for colleagues', reward: 250, type: 'Points', progress: 3, total: 10, status: 'in-progress' },
  ],
  monthly: [
    { id: 'qm1', title: 'Support Marathon', description: 'Resolve 1000 tickets this month', reward: 2000, type: 'Points', progress: 845, total: 1000, status: 'in-progress' },
    { id: 'qm2', title: 'The Perfectionist', description: 'Zero QA deductions for the entire month', reward: 1, type: 'Badge: Flawless', progress: 1, total: 1, status: 'in-progress' },
  ],
};

const STORE_ITEMS = [
  { id: 's1', name: 'Custom Profile Frame (Neon)', description: 'Stand out on the leaderboard with a glowing neon frame.', price: 5000, category: 'Cosmetic', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=300&q=80' },
  { id: 's2', name: 'Avatar: Cyberpunk Doge', description: 'Exclusive animated avatar for your profile.', price: 7500, category: 'Cosmetic', image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=300&q=80' },
  { id: 's3', name: '1-Hour Extra Paid Break', description: 'Redeem for an additional hour of break time this week.', price: 15000, category: 'Perk', image: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=300&q=80' },
  { id: 's4', name: '$25 Amazon Gift Card', description: 'Digital gift card sent straight to your email.', price: 25000, category: 'Reward', image: 'https://images.unsplash.com/photo-1607083206968-13611e3d7624?auto=format&fit=crop&w=300&q=80' },
  { id: 's5', name: 'Choose Next Team Lunch', description: 'You get to pick the restaurant for the next catered team lunch.', price: 30000, category: 'Perk', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=300&q=80' },
  { id: 's6', name: 'Title: Support Jedi', description: 'Special title displayed next to your name internally.', price: 10000, category: 'Cosmetic', image: 'https://images.unsplash.com/photo-1478479405421-ce83c92fb3ba?auto=format&fit=crop&w=300&q=80' },
];

const USER_STATS = {
  currentPoints: 12450,
  lifetimePoints: 84500,
  currentTier: 'Platinum',
  nextTier: 'Diamond',
  pointsToNextTier: 2550,
  rank: 4,
  streak: 14,
  totalBadges: 12,
  questsCompleted: 87,
};

// ============================================================================
// HELPERS
// ============================================================================

const TIER_TONE: Record<string, BadgeTone> = {
  Diamond: 'info',
  Platinum: 'accent',
  Gold: 'warning',
  Silver: 'neutral',
  Bronze: 'warning',
};

const RARITY_TONE: Record<BadgeRarity, BadgeTone> = {
  Legendary: 'warning',
  Epic: 'accent',
  Rare: 'info',
  Uncommon: 'neutral',
};

function csatTone(csat: number): BadgeTone {
  if (csat >= 98) return 'success';
  if (csat >= 95) return 'accent';
  return 'warning';
}

// ============================================================================
// TAB CONTENT
// ============================================================================

function OverviewTab(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available Points"
          value={USER_STATS.currentPoints.toLocaleString()}
          icon={Coins}
          delta={{ value: '+450 today', tone: 'up' }}
        />
        <Card variant="outlined" padding="md">
          <CardBody>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Current Tier</p>
                <h3 className="text-3xl font-bold text-[var(--st-text)] mt-1">{USER_STATS.currentTier}</h3>
              </div>
              <span className="p-2.5 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                <Crown className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                <span>{USER_STATS.pointsToNextTier} pts to {USER_STATS.nextTier}</span>
                <span>82%</span>
              </div>
              <Progress value={82} tone="accent" size="sm" aria-label="Progress to next tier" />
            </div>
          </CardBody>
        </Card>
        <Card variant="outlined" padding="md">
          <CardBody>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Login Streak</p>
                <h3 className="text-3xl font-bold text-[var(--st-text)] mt-1">{USER_STATS.streak} Days</h3>
              </div>
              <span className="p-2.5 rounded-[var(--st-radius)] bg-[var(--st-danger-soft)] text-[var(--st-danger)]">
                <Flame className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-4">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-[var(--st-radius-pill)] ${i < 5 ? 'bg-[var(--st-accent)]' : 'bg-[var(--st-bg-muted)]'}`}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--st-text-tertiary)] mt-2">2 days left for weekly bonus.</p>
          </CardBody>
        </Card>
        <Card variant="outlined" padding="md">
          <CardBody>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Global Rank</p>
                <h3 className="text-3xl font-bold text-[var(--st-text)] mt-1">#{USER_STATS.rank}</h3>
              </div>
              <span className="p-2.5 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                <Trophy className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-3">
              <div className="flex -space-x-2">
                {LEADERBOARD_DATA.slice(0, 3).map((user) => (
                  <Avatar key={user.id} className="w-6 h-6 border border-[var(--st-border)]" data-shape="round">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[var(--st-text-secondary)]">Top 5% of agents</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Two column layout below */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Quests Widget */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" /> Active Quests
            </h4>
            <Button variant="ghost" size="sm" iconRight={ArrowRight}>View All</Button>
          </div>

          <Card variant="outlined" padding="none">
            <CardBody className="p-1">
              {QUESTS_DATA.daily.map((quest) => {
                const done = quest.status === 'completed';
                return (
                  <div
                    key={quest.id}
                    className="p-4 rounded-[var(--st-radius)] flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[var(--st-bg-secondary)] transition-colors"
                  >
                    <span
                      className={`p-3 rounded-[var(--st-radius)] flex-shrink-0 ${done ? 'bg-[var(--st-accent-soft)] text-[var(--st-status-ok)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'}`}
                    >
                      {done ? <CheckCircle className="w-6 h-6" aria-hidden="true" /> : <Clock className="w-6 h-6" aria-hidden="true" />}
                    </span>
                    <div className="flex-1">
                      <h5 className="font-medium text-[var(--st-text)]">{quest.title}</h5>
                      <p className="text-sm text-[var(--st-text-secondary)] mt-0.5">{quest.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex-1 max-w-xs">
                          <Progress
                            value={(quest.progress / quest.total) * 100}
                            tone={done ? 'success' : 'accent'}
                            size="sm"
                            aria-label={`${quest.title} progress`}
                          />
                        </div>
                        <span className="text-xs text-[var(--st-text-tertiary)]">{quest.progress}/{quest.total}</span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-[var(--st-border)] pt-3 sm:pt-0 sm:pl-4 mt-3 sm:mt-0">
                      <span className="text-sm font-medium text-[var(--st-warn)] flex items-center gap-1">
                        +{quest.reward} <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                      <Button variant={done ? 'primary' : 'secondary'} size="sm" disabled={!done}>
                        {done ? 'Claim' : 'In Progress'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--st-status-ok)]" aria-hidden="true" /> Recent Activity
          </h4>
          <Card variant="outlined" padding="md">
            <CardBody className="space-y-3">
              {[
                { time: '10 mins ago', title: 'Unlocked Badge', desc: 'Earned "Speed Demon" badge', icon: Zap },
                { time: '1 hour ago', title: 'Quest Completed', desc: 'Finished "Inbox Zero" daily quest', icon: CheckCircle },
                { time: '3 hours ago', title: 'Leveled Up', desc: 'Reached Level 42', icon: ArrowUpRight },
                { time: 'Yesterday', title: 'Redeemed Reward', desc: 'Bought "Neon Frame" from Store', icon: ShoppingCart },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] shrink-0">
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-[var(--st-text)] text-sm">{item.title}</span>
                        <span className="text-[10px] text-[var(--st-text-tertiary)] whitespace-nowrap">{item.time}</span>
                      </div>
                      <div className="text-xs text-[var(--st-text-secondary)]">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTab(): React.JSX.Element {
  const { toast } = useToast();
  const [range, setRange] = useState('This Month');

  const podium = [
    { user: LEADERBOARD_DATA[1], place: 2, height: 'h-32', icon: Medal },
    { user: LEADERBOARD_DATA[0], place: 1, height: 'h-40', icon: Trophy },
    { user: LEADERBOARD_DATA[2], place: 3, height: 'h-24', icon: Medal },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Field className="w-64">
            <Input type="text" placeholder="Search agents..." iconLeft={Search} aria-label="Search agents" />
          </Field>
          <IconButton label="Filter agents" icon={Filter} variant="outline" />
        </div>
        <div className="flex gap-1">
          {['All Time', 'This Month', 'This Week'].map((lbl) => (
            <Button
              key={lbl}
              variant={range === lbl ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRange(lbl)}
            >
              {lbl}
            </Button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="py-10 flex justify-center items-end gap-2 sm:gap-6">
        {podium.map(({ user, place, height, icon: Icon }) => {
          const isFirst = place === 1;
          return (
            <div
              key={user.id}
              className={`flex flex-col items-center ${isFirst ? 'w-28 sm:w-36' : 'w-24 sm:w-32'}`}
            >
              {isFirst ? (
                <Crown className="w-9 h-9 text-[var(--st-warn)] mb-1" aria-hidden="true" />
              ) : null}
              <div className="relative mb-4">
                <Avatar
                  className={isFirst ? 'w-20 h-20 sm:w-24 sm:h-24 border-2 border-[var(--st-accent)]' : 'w-16 h-16 sm:w-20 sm:h-20 border border-[var(--st-border-strong)]'}
                  data-shape="round"
                >
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[var(--st-accent)] text-[var(--st-text-inverted)] w-7 h-7 rounded-[var(--st-radius-pill)] flex items-center justify-center font-bold text-sm border-2 border-[var(--st-bg)]">
                  {place}
                </span>
              </div>
              <div className="text-center mb-4">
                <h4 className="font-bold text-[var(--st-text)] text-sm sm:text-base truncate w-full">{user.name}</h4>
                <p className="text-xs text-[var(--st-warn)] font-medium">{user.points.toLocaleString()} pts</p>
              </div>
              <div
                className={`w-full ${height} bg-[var(--st-bg-secondary)] border-t border-x border-[var(--st-border)] rounded-t-[var(--st-radius-lg)] flex justify-center pt-4`}
              >
                <Icon className="w-8 h-8 text-[var(--st-text-tertiary)]" aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Table */}
      <Card variant="outlined" padding="none">
        <div className="overflow-x-auto">
          <Table hover>
            <THead>
              <Tr>
                <Th align="center" width={64}>Rank</Th>
                <Th>Agent</Th>
                <Th>Tier</Th>
                <Th>CSAT</Th>
                <Th>Tickets</Th>
                <Th align="right">Points</Th>
              </Tr>
            </THead>
            <TBody>
              {LEADERBOARD_DATA.slice(3).map((user, idx) => {
                const up = user.change.startsWith('+');
                return (
                  <Tr key={user.id}>
                    <Td align="center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-[var(--st-text-tertiary)]">{idx + 4}</span>
                        {user.change !== '0' ? (
                          <span className={`text-[10px] flex items-center ${up ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-danger)]'}`}>
                            <ArrowUpRight className={`w-3 h-3 ${up ? '' : 'rotate-90'}`} aria-hidden="true" />
                            {user.change.replace('+', '').replace('-', '')}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border border-[var(--st-border)]" data-shape="round">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-[var(--st-text)]">{user.name}</div>
                          <div className="text-xs text-[var(--st-text-tertiary)]">{user.role}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={TIER_TONE[user.tier] ?? 'neutral'} kind="outline">
                        <Hexagon className="w-3 h-3" aria-hidden="true" /> {user.tier}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--st-text)]">{user.csat}%</span>
                        <div className="w-16 hidden sm:block">
                          <Progress value={user.csat} tone={csatTone(user.csat) === 'success' ? 'success' : csatTone(user.csat) === 'accent' ? 'accent' : 'warning'} size="sm" aria-label={`${user.name} CSAT`} />
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm text-[var(--st-text-secondary)]">{user.tickets}</Td>
                    <Td align="right">
                      <span className="text-base font-bold text-[var(--st-warn)]">{user.points.toLocaleString()}</span>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
        <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex justify-center">
          <Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => toast.success('All agents loaded')}>
            Load More
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BadgesTab(): React.JSX.Element {
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-[var(--st-text)]">Badge Collection</h3>
          <p className="text-sm text-[var(--st-text-secondary)]">Earn badges to unlock special profile borders and titles.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--st-accent)]">
              {USER_STATS.totalBadges}<span className="text-sm text-[var(--st-text-tertiary)] font-normal">/45</span>
            </div>
            <div className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider">Unlocked</div>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <Field className="w-44">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger aria-label="Filter badges">
                <SelectValue placeholder="All Badges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Badges</SelectItem>
                <SelectItem value="unlocked">Unlocked Only</SelectItem>
                <SelectItem value="locked">Locked Only</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {BADGES_DATA.map((badge) => {
          const Icon = badge.icon;
          return (
            <Card key={badge.id} variant="outlined" padding="none">
              <CardBody className="p-6 flex flex-col items-center text-center">
                <div className="relative w-24 h-24 mb-4">
                  <span
                    className={`w-24 h-24 rounded-[var(--st-radius-pill)] flex items-center justify-center ${badge.unlocked ? 'bg-[var(--st-accent-soft)]' : 'bg-[var(--st-bg-muted)]'}`}
                  >
                    <Icon
                      className={`w-12 h-12 ${badge.unlocked ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-tertiary)]'}`}
                      aria-hidden="true"
                    />
                  </span>
                  {badge.unlocked ? (
                    <span className="absolute -top-1 -right-1 text-[var(--st-status-ok)]">
                      <CheckCircle className="w-5 h-5" aria-hidden="true" />
                    </span>
                  ) : null}
                  {!badge.unlocked && badge.progress > 0 ? (
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                      <circle cx="50" cy="50" r="48" fill="none" stroke="var(--st-border)" strokeWidth="4" />
                      <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke="var(--st-accent)"
                        strokeWidth="4"
                        strokeDasharray={`${(badge.progress / 100) * 301.59} 301.59`}
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : null}
                </div>

                <h4 className="text-lg font-bold text-[var(--st-text)] mb-1">{badge.name}</h4>
                <div className="mb-3">
                  <Badge tone={RARITY_TONE[badge.rarity]} kind="outline">{badge.rarity}</Badge>
                </div>
                <p className="text-xs text-[var(--st-text-secondary)] leading-relaxed mb-4 flex-grow">{badge.description}</p>

                {!badge.unlocked ? (
                  <div className="w-full mt-auto">
                    <div className="flex justify-between text-[10px] text-[var(--st-text-tertiary)] mb-1">
                      <span>Progress</span>
                      <span>{badge.progress}%</span>
                    </div>
                    <Progress value={badge.progress} tone="accent" size="sm" aria-label={`${badge.name} progress`} />
                  </div>
                ) : (
                  <div className="w-full mt-auto">
                    <Button variant="secondary" size="sm" block onClick={() => toast.success(`"${badge.name}" set as display badge`)}>
                      Set as Display Badge
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StoreTab(): React.JSX.Element {
  const { toast } = useToast();
  const [storeFilter, setStoreFilter] = useState('All Items');

  return (
    <div className="space-y-6">
      <Card variant="outlined" padding="lg">
        <CardBody className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--st-text)] mb-2 flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="w-6 h-6 text-[var(--st-warn)]" aria-hidden="true" />
              Rewards Store
            </h2>
            <p className="text-[var(--st-text-secondary)] max-w-md">
              Redeem your hard-earned points for exclusive profile customization, real-world perks, and gift cards.
            </p>
          </div>

          <div className="flex flex-col items-center p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] min-w-[200px]">
            <span className="text-sm text-[var(--st-text-secondary)] mb-1">Your Balance</span>
            <div className="flex items-center gap-2 text-3xl font-bold text-[var(--st-warn)]">
              <Coins className="w-8 h-8" aria-hidden="true" /> {USER_STATS.currentPoints.toLocaleString()}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => toast({ title: 'Earning history coming soon', tone: 'info' })}>
              View earning history
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Store Filters */}
      <div className="flex overflow-x-auto pb-2 gap-2">
        {['All Items', 'Cosmetics', 'Perks', 'Gift Cards', 'Company Swag'].map((filter) => (
          <Button
            key={filter}
            variant={storeFilter === filter ? 'primary' : 'secondary'}
            size="sm"
            className="whitespace-nowrap"
            onClick={() => setStoreFilter(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Store Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {STORE_ITEMS.map((item) => {
          const affordable = USER_STATS.currentPoints >= item.price;
          return (
            <Card key={item.id} variant="outlined" padding="none" className="overflow-hidden flex flex-col">
              <div className="h-48 relative overflow-hidden bg-[var(--st-bg-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3">
                  <Badge tone="neutral" kind="solid">{item.category}</Badge>
                </div>
                {!affordable ? (
                  <div className="absolute bottom-3 left-3">
                    <Badge tone="danger" kind="solid">
                      <Lock className="w-3 h-3" aria-hidden="true" /> Need {((item.price - USER_STATS.currentPoints) / 1000).toFixed(1)}k more pts
                    </Badge>
                  </div>
                ) : null}
              </div>

              <CardBody className="p-5 flex flex-col flex-grow">
                <h4 className="text-lg font-bold text-[var(--st-text)] mb-2 leading-tight">{item.name}</h4>
                <p className="text-sm text-[var(--st-text-secondary)] mb-6 flex-grow">{item.description}</p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--st-border)]">
                  <div className="flex items-center gap-1.5 font-bold text-lg text-[var(--st-warn)]">
                    <Coins className="w-5 h-5" aria-hidden="true" /> {item.price.toLocaleString()}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!affordable}
                    onClick={() => toast.success(`Redeemed "${item.name}"`)}
                  >
                    Redeem
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function QuestsTab({ onGoToOverview }: { onGoToOverview: () => void }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-96">
      <EmptyState
        icon={Target}
        title="Full Quest Tracker"
        description="View all daily, weekly, and monthly quests. Build streaks and earn massive bonus points."
        action={<Button variant="primary" onClick={onGoToOverview}>View Active Quests in Overview</Button>}
      />
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function GamificationPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('overview');

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'quests', label: 'Quests & Goals', icon: Target, count: 5 },
    { id: 'badges', label: 'Badges', icon: Medal },
    { id: 'store', label: 'Rewards Store', icon: ShoppingCart },
  ];

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--st-text)] tracking-tight flex items-center gap-3">
              <span className="p-2 bg-[var(--st-accent-soft)] rounded-[var(--st-radius)] text-[var(--st-accent)]">
                <Gem className="w-7 h-7" aria-hidden="true" />
              </span>
              Gamification Center
            </h1>
            <p className="text-[var(--st-text-secondary)] mt-2 text-sm max-w-2xl">
              Track your progress, complete quests, earn badges, and compete with your team. Turn your hard work into rewards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 pl-4 border-l border-[var(--st-border)]">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-[var(--st-text)]">Alex Chen</div>
                <div className="text-xs text-[var(--st-accent)] font-medium">Diamond Tier</div>
              </div>
              <Avatar className="w-10 h-10 border-2 border-[var(--st-accent)]" data-shape="round">
                <AvatarImage src="https://i.pravatar.cc/150?u=1" alt="Alex Chen" />
                <AvatarFallback>AC</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {tab.label}
                    {tab.count !== undefined ? (
                      <Badge tone="accent" kind="soft">{tab.count}</Badge>
                    ) : null}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="min-h-[600px]">
            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="leaderboard"><LeaderboardTab /></TabsContent>
            <TabsContent value="quests"><QuestsTab onGoToOverview={() => setActiveTab('overview')} /></TabsContent>
            <TabsContent value="badges"><BadgesTab /></TabsContent>
            <TabsContent value="store"><StoreTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
