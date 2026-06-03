"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Users,
  Shield,
  Trophy,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  ThumbsUp,
  MessageCircle,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  Settings,
  Star,
  Award,
  Activity,
  ArrowRight,
  UserCheck,
  Flag,
  Trash2,
  Lock,
  Unlock,
  Pin,
} from "lucide-react";

// Mock Data
const forums = [
  { id: 1, name: "General Discussion", desc: "Talk about anything related to our products.", topics: 1245, posts: 8432, lastActive: "2 mins ago" },
  { id: 2, name: "Feature Requests", desc: "Submit and vote on new features.", topics: 856, posts: 4120, lastActive: "15 mins ago" },
  { id: 3, name: "Bug Reports", desc: "Report issues and get help from the community.", topics: 432, posts: 2150, lastActive: "1 hour ago" },
  { id: 4, name: "Showcase", desc: "Show off what you've built using our platform.", topics: 215, posts: 1045, lastActive: "3 hours ago" },
  { id: 5, name: "Developer API", desc: "Technical discussions and integration help.", topics: 643, posts: 3210, lastActive: "5 hours ago" },
];

const flaggedPosts = [
  { id: 101, user: "AlexD", avatar: "AD", content: "This software is absolute garbage and everyone who uses it is stupid...", reason: "Harassment", date: "10 mins ago", severity: "high" },
  { id: 102, user: "SpamBot99", avatar: "SB", content: "CLICK HERE FOR FREE CRYPTO 100% LEGIT NO SCAM!! http://spam...", reason: "Spam", date: "1 hour ago", severity: "high" },
  { id: 103, user: "JohnSmith", avatar: "JS", content: "I can't believe the customer support here. It took 2 whole hours...", reason: "Inappropriate Language", date: "3 hours ago", severity: "low" },
];

const members = Array.from({ length: 20 }).map((_, i) => ({
  id: `mem-${i}`,
  name: ["Alice Cooper", "Bob Builder", "Charlie Day", "Diana Prince", "Eve Adams"][i % 5],
  role: i === 0 ? "Admin" : i < 3 ? "Moderator" : "Member",
  joined: `202${i % 3 + 1}-0${i % 9 + 1}-15`,
  posts: Math.floor(Math.random() * 500),
  reputation: Math.floor(Math.random() * 1000),
  status: ["Active", "Banned", "Muted", "Active", "Active"][i % 5]
}));

const badges = [
  { id: 1, name: "Helpful Hero", icon: <ThumbsUp className="w-5 h-5" />, color: "bg-blue-500", desc: "Received 100 upvotes" },
  { id: 2, name: "Solution Master", icon: <CheckCircle className="w-5 h-5" />, color: "bg-emerald-500", desc: "Provided 50 accepted answers" },
  { id: 3, name: "Bug Hunter", icon: <AlertTriangle className="w-5 h-5" />, color: "bg-rose-500", desc: "Reported 10 confirmed bugs" },
  { id: 4, name: "Community Pillar", icon: <Users className="w-5 h-5" />, color: "bg-purple-500", desc: "Active for 1 consecutive year" },
];

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState("forums");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-emerald-400" />
            Community & Forums
          </h1>
          <p className="text-slate-400 mt-1">Manage discussion boards, moderation queues, and user engagement.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 transition-colors border border-slate-700 shadow-sm">
            <Eye className="w-4 h-4" />
            View Live Forum
          </button>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" />
            New Board
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-800 mb-6 pb-2 gap-6 scrollbar-hide">
        <button
          onClick={() => setActiveTab("forums")}
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "forums" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Boards & Topics
        </button>
        <button
          onClick={() => setActiveTab("moderation")}
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "moderation" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Shield className="w-4 h-4" /> Moderation Queue
          <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">3</span>
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "members" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" /> Members & Roles
        </button>
        <button
          onClick={() => setActiveTab("gamification")}
          className={`pb-2 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "gamification" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Trophy className="w-4 h-4" /> Gamification
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[700px] flex flex-col">
        
        {/* Forums Tab */}
        {activeTab === "forums" && (
          <>
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between gap-4 bg-slate-900/50">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search boards..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-950">
              {forums.map((forum) => (
                <div key={forum.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                          {forum.name}
                          {forum.id === 1 && <Pin className="w-4 h-4 text-slate-500 fill-slate-500" />}
                        </h3>
                        <p className="text-slate-400 text-sm">{forum.desc}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8 md:gap-12">
                    <div className="flex gap-6 text-center">
                      <div>
                        <div className="text-lg font-bold text-slate-200">{forum.topics.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Topics</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-slate-200">{forum.posts.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Posts</div>
                      </div>
                    </div>
                    
                    <div className="hidden md:block w-32 text-right">
                      <div className="text-sm text-slate-300">Last Post</div>
                      <div className="text-xs text-slate-500 flex items-center justify-end gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {forum.lastActive}
                      </div>
                    </div>
                    
                    <div className="md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Moderation Tab */}
        {activeTab === "moderation" && (
          <div className="flex h-full flex-col">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-200">Moderation Queue</h2>
                <p className="text-sm text-slate-400">Review flagged content and reported users.</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-lg text-sm">Auto-Mod Rules</button>
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-700">Clear All</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-950">
              {flaggedPosts.map((post) => (
                <div key={post.id} className={`border rounded-xl p-5 relative overflow-hidden ${
                  post.severity === 'high' ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
                }`}>
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    post.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500'
                  }`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700">
                        {post.avatar}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{post.user}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <Flag className="w-3 h-3 text-rose-400" />
                          Reported for: <span className="text-slate-300">{post.reason}</span> • {post.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium border border-emerald-500/20 flex items-center gap-1.5 transition-colors">
                        <CheckCircle className="w-4 h-4" /> Ignore
                      </button>
                      <button className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-sm font-medium border border-rose-500/20 flex items-center gap-1.5 transition-colors">
                        <Trash2 className="w-4 h-4" /> Delete Post
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-300 text-sm italic">
                    "{post.content}"
                  </div>
                  
                  <div className="mt-4 flex gap-4 text-sm">
                    <button className="text-slate-400 hover:text-slate-200 flex items-center gap-1">
                      <Ban className="w-4 h-4" /> Ban User
                    </button>
                    <button className="text-slate-400 hover:text-slate-200 flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" /> Send Warning
                    </button>
                  </div>
                </div>
              ))}
              
              {flaggedPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <Shield className="w-12 h-12 mb-4 opacity-50" />
                  <p>Hooray! The moderation queue is empty.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                <option>All Roles</option>
                <option>Admins</option>
                <option>Moderators</option>
                <option>Members</option>
              </select>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Member</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Role</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Activity</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
                            {member.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{member.name}</div>
                            <div className="text-xs text-slate-500">Joined {member.joined}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          member.role === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          member.role === 'Moderator' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-slate-700/30 text-slate-300 border-slate-700'
                        }`}>
                          {member.role === 'Admin' && <Shield className="w-3 h-3 mr-1" />}
                          {member.role === 'Moderator' && <UserCheck className="w-3 h-3 mr-1" />}
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300">
                          <span className="font-medium">{member.posts}</span> posts
                        </div>
                        <div className="text-xs text-emerald-400/80 flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3" /> {member.reputation} rep
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          member.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          member.status === 'Banned' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-sm text-slate-400">
              <span>Showing 20 of 1,248 members</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800">Prev</button>
                <button className="px-3 py-1 bg-emerald-600 text-white border border-emerald-500 rounded hover:bg-emerald-500">1</button>
                <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800">2</button>
                <button className="px-3 py-1 border border-slate-800 rounded hover:bg-slate-800">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* Gamification Tab */}
        {activeTab === "gamification" && (
          <div className="p-8 overflow-auto h-full bg-slate-950">
            <div className="max-w-4xl mx-auto space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20"><Activity className="w-24 h-24" /></div>
                  <h3 className="text-emerald-400 font-semibold mb-2">Engagement Score</h3>
                  <p className="text-3xl font-bold text-white mb-1">84/100</p>
                  <p className="text-sm text-emerald-400/80">Excellent community health</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-slate-400 font-semibold mb-2">Badges Awarded</h3>
                  <p className="text-3xl font-bold text-white mb-1">1,432</p>
                  <p className="text-sm text-emerald-400 flex items-center gap-1">+124 this month</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-slate-400 font-semibold mb-2">Top Contributor</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">AC</div>
                    <div>
                      <p className="font-bold text-slate-200">Alice Cooper</p>
                      <p className="text-xs text-slate-400">12.4k points</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-400" />
                      Badges & Achievements
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Configure rewards for user behavior.</p>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg flex items-center gap-2 transition-colors">
                    <Plus className="w-4 h-4" /> Create Badge
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex items-start gap-4 p-4 border border-slate-800 bg-slate-900 rounded-xl hover:border-slate-700 transition-colors cursor-pointer">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${badge.color}`}>
                        {badge.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-200">{badge.name}</h4>
                        <p className="text-sm text-slate-400 mt-1">{badge.desc}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs font-medium">
                          <span className="text-slate-500">Level 1+</span>
                          <span className="text-emerald-400">Awarded to 45 users</span>
                        </div>
                      </div>
                      <button className="text-slate-500 hover:text-slate-300"><Edit className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-200 mb-6 border-b border-slate-800 pb-4">Point System Rules</h2>
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase">Action</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase">Points</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase">Limit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-200">Creating a new topic</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-sm font-bold">+10</span></td>
                        <td className="px-6 py-4 text-sm text-slate-400">5 per day</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-200">Replying to a topic</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-sm font-bold">+2</span></td>
                        <td className="px-6 py-4 text-sm text-slate-400">No limit</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-200">Receiving an upvote</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-sm font-bold">+5</span></td>
                        <td className="px-6 py-4 text-sm text-slate-400">No limit</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-200">Having an answer accepted</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-sm font-bold">+15</span></td>
                        <td className="px-6 py-4 text-sm text-slate-400">No limit</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-200">Post deleted by moderator</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded text-sm font-bold">-20</span></td>
                        <td className="px-6 py-4 text-sm text-slate-400">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Dummy Edit icon as it was used but not imported
const Edit = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
);
