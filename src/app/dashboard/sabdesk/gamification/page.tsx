'use client';

import React, { useState, useEffect } from 'react';
import { 
  Trophy, Star, Medal, Zap, Target, Award, Crown, 
  TrendingUp, Activity, Gift, Clock, Shield, User,
  ChevronRight, Filter, Search, MoreVertical, Flame,
  CheckCircle, Circle, Map, Compass, Settings, 
  ShoppingCart, Coins, ArrowUpRight, Plus, Download,
  Heart, Sparkles, Gem, ArrowRight, Share2, MessageSquare,
  BarChart2, Bell, Hexagon, Calendar, Briefcase, Lock,
  Unlock, Hash, Users, CreditCard, LayoutDashboard,
  Check
} from 'lucide-react';

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

const BADGES_DATA = [
  { id: 'b1', name: 'Speed Demon', description: 'Resolve 100 tickets with first response < 5m', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10', progress: 100, unlocked: true, rarity: 'Epic' },
  { id: 'b2', name: 'Empathy Guru', description: 'Receive 50 5-star CSAT ratings mentioning "helpful"', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-400/10', progress: 100, unlocked: true, rarity: 'Legendary' },
  { id: 'b3', name: 'Bug Smasher', description: 'Identify and escalate 20 confirmed platform bugs', icon: Shield, color: 'text-red-400', bg: 'bg-red-400/10', progress: 85, unlocked: false, rarity: 'Rare' },
  { id: 'b4', name: 'Night Owl', description: 'Resolve 500 tickets between 10PM and 6AM', icon: Clock, color: 'text-indigo-400', bg: 'bg-indigo-400/10', progress: 42, unlocked: false, rarity: 'Uncommon' },
  { id: 'b5', name: 'Mentor', description: 'Help onboard 5 new support agents', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', progress: 100, unlocked: true, rarity: 'Epic' },
  { id: 'b6', name: 'Knowledge Keeper', description: 'Create or update 50 KB articles', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-400/10', progress: 12, unlocked: false, rarity: 'Rare' },
  { id: 'b7', name: 'Unbreakable', description: 'Maintain a 30-day login streak', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-400/10', progress: 28, unlocked: false, rarity: 'Epic' },
  { id: 'b8', name: 'Zen Master', description: 'De-escalate 10 angry customer interactions successfully', icon: Target, color: 'text-teal-400', bg: 'bg-teal-400/10', progress: 9, unlocked: false, rarity: 'Legendary' },
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
  ]
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
  questsCompleted: 87
};

// ============================================================================
// COMPONENTS
// ============================================================================

const TabButton = ({ active, onClick, icon: Icon, label, count }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all ${
      active 
        ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' 
        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
    {count !== undefined && (
      <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
        {count}
      </span>
    )}
  </button>
);

const ProgressBar = ({ progress, color = 'bg-indigo-500', height = 'h-2' }: any) => (
  <div className={`w-full bg-slate-800 rounded-full overflow-hidden ${height}`}>
    <div 
      className={`${color} h-full rounded-full transition-all duration-1000 ease-out`}
      style={ width: `${Math.min(100, Math.max(0, progress))}%` }
    />
  </div>
);

// --- TABS CONTENT ---

const OverviewTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    
    {/* Top Stats Row */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-slate-400 text-sm font-medium">Available Points</p>
            <h3 className="text-3xl font-bold text-white mt-1">{USER_STATS.currentPoints.toLocaleString()}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" /> +450 today
          </span>
          <span className="text-slate-500">Lifetime: {USER_STATS.lifetimePoints.toLocaleString()}</span>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-slate-400 text-sm font-medium">Current Tier</p>
            <h3 className="text-3xl font-bold text-white mt-1">{USER_STATS.currentTier}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Crown className="w-5 h-5" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{USER_STATS.pointsToNextTier} pts to {USER_STATS.nextTier}</span>
            <span>82%</span>
          </div>
          <ProgressBar progress={82} color="bg-gradient-to-r from-amber-500 to-orange-400" />
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 relative overflow-hidden group hover:border-rose-500/30 transition-colors">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-slate-400 text-sm font-medium">Login Streak</p>
            <h3 className="text-3xl font-bold text-white mt-1">{USER_STATS.streak} Days</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < 5 ? 'bg-rose-500' : 'bg-slate-700'}`} />
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">2 days left for weekly bonus!</p>
      </div>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-slate-400 text-sm font-medium">Global Rank</p>
            <h3 className="text-3xl font-bold text-white mt-1">#{USER_STATS.rank}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm mt-3">
          <div className="flex -space-x-2">
            {LEADERBOARD_DATA.slice(0, 3).map((user, i) => (
              <img key={i} src={user.avatar} className="w-6 h-6 rounded-full border border-slate-800" alt="" />
            ))}
          </div>
          <span className="text-slate-400">Top 5% of agents</span>
        </div>
      </div>
    </div>

    {/* Two column layout below */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Active Quests Widget */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" /> Active Quests
          </h4>
          <button className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-1">
          {QUESTS_DATA.daily.map((quest) => (
            <div key={quest.id} className="p-4 hover:bg-white/[0.02] transition-colors rounded-xl flex flex-col sm:flex-row sm:items-center gap-4 group">
              <div className={`p-3 rounded-xl flex-shrink-0 ${quest.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                {quest.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-slate-200 group-hover:text-white transition-colors">{quest.title}</h5>
                <p className="text-sm text-slate-400 mt-0.5">{quest.description}</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 max-w-xs">
                    <ProgressBar 
                      progress={(quest.progress / quest.total) * 100} 
                      color={quest.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'} 
                      height="h-1.5"
                    />
                  </div>
                  <span className="text-xs text-slate-500">{quest.progress}/{quest.total}</span>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-white/5 pt-3 sm:pt-0 sm:pl-4 mt-3 sm:mt-0">
                <span className="text-sm font-medium text-amber-400 flex items-center gap-1">
                  +{quest.reward} <Coins className="w-3.5 h-3.5" />
                </span>
                <button 
                  disabled={quest.status !== 'completed'} 
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    quest.status === 'completed' 
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {quest.status === 'completed' ? 'Claim' : 'In Progress'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity / Mini Leaderboard */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" /> Recent Activity
        </h4>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
            {[
              { time: '10 mins ago', title: 'Unlocked Badge', desc: 'Earned "Speed Demon" badge', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { time: '1 hour ago', title: 'Quest Completed', desc: 'Finished "Inbox Zero" daily quest', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
              { time: '3 hours ago', title: 'Leveled Up', desc: 'Reached Level 42', icon: ArrowUpRight, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
              { time: 'Yesterday', title: 'Redeemed Reward', desc: 'Bought "Neon Frame" from Store', icon: ShoppingCart, color: 'text-pink-400', bg: 'bg-pink-400/10' },
            ].map((item, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-900 ${item.bg} ${item.color} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-slate-900 absolute -left-6 md:left-1/2`}>
                  <item.icon className="w-3 h-3" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 text-sm">{item.title}</span>
                    <span className="text-[10px] text-slate-500">{item.time}</span>
                  </div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LeaderboardTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search agents..." 
            className="pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white w-64 transition-all"
          />
        </div>
        <button className="p-2 bg-slate-900 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <Filter className="w-4 h-4" />
        </button>
      </div>
      <div className="flex bg-slate-900 border border-white/10 rounded-lg p-1">
        {['All Time', 'This Month', 'This Week'].map((lbl, i) => (
          <button key={i} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${i === 1 ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>

    {/* Top 3 Podium */}
    <div className="py-12 flex justify-center items-end gap-2 sm:gap-6">
      {/* 2nd Place */}
      <div className="flex flex-col items-center relative z-10 w-24 sm:w-32 animate-in slide-in-from-bottom-12 duration-700 delay-100">
        <div className="relative mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-gradient-to-b from-slate-300 to-slate-500">
            <img src={LEADERBOARD_DATA[1].avatar} className="w-full h-full rounded-full border-2 border-slate-900" alt="" />
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm border-2 border-slate-900 shadow-lg">2</div>
        </div>
        <div className="text-center mb-4">
          <h4 className="font-bold text-white text-sm sm:text-base truncate w-full">{LEADERBOARD_DATA[1].name}</h4>
          <p className="text-xs text-amber-400 font-medium">{LEADERBOARD_DATA[1].points.toLocaleString()} pts</p>
        </div>
        <div className="w-full h-32 bg-gradient-to-t from-slate-800/80 to-slate-800/20 border-t border-x border-slate-700/50 rounded-t-lg backdrop-blur-sm relative overflow-hidden flex justify-center pt-4">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <Medal className="w-8 h-8 text-slate-400 opacity-50" />
        </div>
      </div>

      {/* 1st Place */}
      <div className="flex flex-col items-center relative z-20 w-28 sm:w-36 animate-in slide-in-from-bottom-16 duration-700">
        <div className="absolute -top-12 animate-bounce">
          <Crown className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" fill="currentColor" />
        </div>
        <div className="relative mb-4">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full p-1.5 bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <img src={LEADERBOARD_DATA[0].avatar} className="w-full h-full rounded-full border-4 border-slate-900" alt="" />
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-base border-4 border-slate-900 shadow-xl">1</div>
        </div>
        <div className="text-center mb-4">
          <h4 className="font-bold text-white text-base sm:text-lg truncate w-full">{LEADERBOARD_DATA[0].name}</h4>
          <p className="text-sm text-yellow-400 font-bold drop-shadow-md">{LEADERBOARD_DATA[0].points.toLocaleString()} pts</p>
        </div>
        <div className="w-full h-40 bg-gradient-to-t from-yellow-900/40 to-yellow-600/10 border-t border-x border-yellow-500/30 rounded-t-lg backdrop-blur-sm relative overflow-hidden flex justify-center pt-4">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <Trophy className="w-10 h-10 text-yellow-500 opacity-50" />
        </div>
      </div>

      {/* 3rd Place */}
      <div className="flex flex-col items-center relative z-10 w-24 sm:w-32 animate-in slide-in-from-bottom-12 duration-700 delay-200">
        <div className="relative mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-gradient-to-b from-orange-400 to-orange-700">
            <img src={LEADERBOARD_DATA[2].avatar} className="w-full h-full rounded-full border-2 border-slate-900" alt="" />
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-500 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm border-2 border-slate-900 shadow-lg">3</div>
        </div>
        <div className="text-center mb-4">
          <h4 className="font-bold text-white text-sm sm:text-base truncate w-full">{LEADERBOARD_DATA[2].name}</h4>
          <p className="text-xs text-amber-400 font-medium">{LEADERBOARD_DATA[2].points.toLocaleString()} pts</p>
        </div>
        <div className="w-full h-24 bg-gradient-to-t from-orange-900/40 to-orange-900/10 border-t border-x border-orange-700/30 rounded-t-lg backdrop-blur-sm relative overflow-hidden flex justify-center pt-4">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <Medal className="w-8 h-8 text-orange-500 opacity-50" />
        </div>
      </div>
    </div>

    {/* Full Table */}
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-white/5">
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16 text-center">Rank</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tier</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">CSAT</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tickets</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {LEADERBOARD_DATA.slice(3).map((user, idx) => (
              <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-500">{idx + 4}</span>
                    {user.change !== '0' && (
                      <span className={`text-[10px] flex items-center ${user.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {user.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3 rotate-90" />}
                        {user.change.replace('+', '').replace('-', '')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <img src={user.avatar} className="w-10 h-10 rounded-full border border-slate-700" alt="" />
                    <div>
                      <div className="font-medium text-white group-hover:text-indigo-400 transition-colors">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border
                    ${user.tier === 'Diamond' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 
                      user.tier === 'Platinum' ? 'bg-slate-300/10 text-slate-300 border-slate-300/20' :
                      user.tier === 'Gold' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      user.tier === 'Silver' ? 'bg-slate-400/10 text-slate-400 border-slate-400/20' :
                      'bg-orange-700/10 text-orange-600 border-orange-700/20'
                    }
                  `}>
                    <Hexagon className="w-3 h-3" /> {user.tier}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300">{user.csat}%</span>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                      <div className={`h-full rounded-full ${user.csat >= 98 ? 'bg-emerald-400' : user.csat >= 95 ? 'bg-indigo-400' : 'bg-amber-400'}`} style={ width: `${user.csat}%` }></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {user.tickets}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-base font-bold text-amber-400">{user.points.toLocaleString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-white/5 bg-slate-800/30 flex justify-center">
        <button className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2">
          Load More <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const BadgesTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h3 className="text-xl font-bold text-white">Badge Collection</h3>
        <p className="text-sm text-slate-400">Earn badges to unlock special profile borders and titles.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-400">12<span className="text-sm text-slate-500 font-normal">/45</span></div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Unlocked</div>
        </div>
        <div className="w-px h-10 bg-white/10"></div>
        <select className="bg-slate-900 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-500">
          <option>All Badges</option>
          <option>Unlocked Only</option>
          <option>Locked Only</option>
          <option>Legendary</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {BADGES_DATA.map((badge) => (
        <div 
          key={badge.id} 
          className={`relative group rounded-2xl border transition-all duration-300 overflow-hidden ${
            badge.unlocked 
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-white/10 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]' 
              : 'bg-slate-900/50 border-white/5 grayscale opacity-70 hover:grayscale-0 hover:opacity-100'
          }`}
        >
          {badge.unlocked && (
            <div className="absolute top-0 right-0 p-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          
          <div className="p-6 flex flex-col items-center text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 relative ${badge.unlocked ? badge.bg : 'bg-slate-800'} transition-all group-hover:scale-110 duration-500`}>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 rounded-full mix-blend-overlay"></div>
              {badge.unlocked && <div className={`absolute inset-0 blur-xl opacity-40 rounded-full ${badge.bg}`}></div>}
              <badge.icon className={`w-12 h-12 relative z-10 ${badge.unlocked ? badge.color : 'text-slate-600'}`} />
              
              {!badge.unlocked && badge.progress > 0 && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                  <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" className="text-indigo-500" strokeWidth="4" strokeDasharray={`${(badge.progress / 100) * 301.59} 301.59`} strokeLinecap="round" />
                </svg>
              )}
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">{badge.name}</h4>
            <div className="mb-3">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-medium
                ${badge.rarity === 'Legendary' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                  badge.rarity === 'Epic' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  badge.rarity === 'Rare' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-slate-500/10 text-slate-400 border-slate-500/20'}
              `}>
                {badge.rarity}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4 flex-grow">{badge.description}</p>
            
            {!badge.unlocked && (
              <div className="w-full mt-auto">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Progress</span>
                  <span>{badge.progress}%</span>
                </div>
                <ProgressBar progress={badge.progress} color="bg-indigo-500" height="h-1.5" />
              </div>
            )}
            
            {badge.unlocked && (
              <div className="w-full mt-auto">
                 <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                   Set as Display Badge
                 </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StoreTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/50 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full"></div>
      
      <div className="relative z-10 text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" /> 
          Rewards Store
        </h2>
        <p className="text-indigo-200 max-w-md">Redeem your hard-earned points for exclusive profile customization, real-world perks, and gift cards.</p>
      </div>
      
      <div className="relative z-10 flex flex-col items-center p-4 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 min-w-[200px]">
        <span className="text-sm text-slate-400 mb-1">Your Balance</span>
        <div className="flex items-center gap-2 text-3xl font-bold text-amber-400">
          <Coins className="w-8 h-8" /> {USER_STATS.currentPoints.toLocaleString()}
        </div>
        <button className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">View earning history</button>
      </div>
    </div>

    {/* Store Filters */}
    <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
      {['All Items', 'Cosmetics', 'Perks', 'Gift Cards', 'Company Swag'].map((filter, i) => (
        <button key={i} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          i === 0 ? 'bg-indigo-500 text-white' : 'bg-slate-900 border border-white/5 text-slate-400 hover:bg-slate-800'
        }`}>
          {filter}
        </button>
      ))}
    </div>

    {/* Store Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {STORE_ITEMS.map((item) => (
        <div key={item.id} className="bg-slate-900/80 border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group flex flex-col">
          <div className="h-48 relative overflow-hidden">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/10">
              {item.category}
            </div>
            {USER_STATS.currentPoints < item.price && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-rose-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                  <Lock className="w-3 h-3" /> Need {((item.price - USER_STATS.currentPoints)/1000).toFixed(1)}k more pts
                </div>
              </div>
            )}
          </div>
          
          <div className="p-5 flex flex-col flex-grow">
            <h4 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-indigo-400 transition-colors">{item.name}</h4>
            <p className="text-sm text-slate-400 mb-6 flex-grow">{item.description}</p>
            
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
              <div className="flex items-center gap-1.5 font-bold text-lg text-amber-400">
                <Coins className="w-5 h-5" /> {item.price.toLocaleString()}
              </div>
              <button 
                disabled={USER_STATS.currentPoints < item.price}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  USER_STATS.currentPoints >= item.price
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Redeem
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function GamificationPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'quests', label: 'Quests & Goals', icon: Target, count: 5 },
    { id: 'badges', label: 'Badges', icon: Medal },
    { id: 'store', label: 'Rewards Store', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-slate-200">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Gem className="w-7 h-7" />
              </span>
              Gamification Center
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-2xl">
              Track your progress, complete quests, earn badges, and compete with your team. Turn your hard work into rewards.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <button className="p-2.5 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-white">Alex Chen</div>
                <div className="text-xs text-indigo-400 font-medium">Diamond Tier</div>
              </div>
              <img src="https://i.pravatar.cc/150?u=1" alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-500/50" />
            </div>
          </div>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="flex overflow-x-auto border-b border-white/10 mb-8 hide-scrollbar">
          {TABS.map(tab => (
            <TabButton 
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
              count={tab.count}
            />
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="min-h-[600px]">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'badges' && <BadgesTab />}
          {activeTab === 'store' && <StoreTab />}
          
          {/* Placeholder for Quests tab to keep file slightly shorter, though Overview handles active quests */}
          {activeTab === 'quests' && (
             <div className="flex flex-col items-center justify-center h-96 text-center space-y-4 animate-in zoom-in duration-500">
               <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                 <Target className="w-12 h-12 text-slate-500" />
               </div>
               <h3 className="text-2xl font-bold text-white">Full Quest Tracker</h3>
               <p className="text-slate-400 max-w-md">View all daily, weekly, and monthly quests. Build streaks and earn massive bonus points.</p>
               <button onClick={() => setActiveTab('overview')} className="mt-4 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium">
                 View Active Quests in Overview
               </button>
             </div>
          )}
        </div>

      </div>
      
      {/* Global styles for hide-scrollbar */}
      <style dangerouslySetInnerHTML={__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `} />
    </div>
  );
}
