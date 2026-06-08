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
  AlertTriangle,
  Ban,
  Settings,
  Star,
  Award,
  Activity,
  UserCheck,
  Flag,
  Trash2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Field,
  Input,
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
  Badge,
  StatCard,
  EmptyState,
  Pagination,
} from "@/components/sabcrm/20ui";

// Mock Data
const forums = [
  { id: 1, name: "General Discussion", desc: "Talk about anything related to our products.", topics: 1245, posts: 8432, lastActive: "2 mins ago", pinned: true },
  { id: 2, name: "Feature Requests", desc: "Submit and vote on new features.", topics: 856, posts: 4120, lastActive: "15 mins ago", pinned: false },
  { id: 3, name: "Bug Reports", desc: "Report issues and get help from the community.", topics: 432, posts: 2150, lastActive: "1 hour ago", pinned: false },
  { id: 4, name: "Showcase", desc: "Show off what you've built using our platform.", topics: 215, posts: 1045, lastActive: "3 hours ago", pinned: false },
  { id: 5, name: "Developer API", desc: "Technical discussions and integration help.", topics: 643, posts: 3210, lastActive: "5 hours ago", pinned: false },
];

const flaggedPosts = [
  { id: 101, user: "AlexD", avatar: "AD", content: "This software is absolute garbage and everyone who uses it is stupid...", reason: "Harassment", date: "10 mins ago", severity: "high" as const },
  { id: 102, user: "SpamBot99", avatar: "SB", content: "CLICK HERE FOR FREE CRYPTO 100% LEGIT NO SCAM!! http://spam...", reason: "Spam", date: "1 hour ago", severity: "high" as const },
  { id: 103, user: "JohnSmith", avatar: "JS", content: "I can't believe the customer support here. It took 2 whole hours...", reason: "Inappropriate Language", date: "3 hours ago", severity: "low" as const },
];

const memberNames = ["Alice Cooper", "Bob Builder", "Charlie Day", "Diana Prince", "Eve Adams"];
const members = Array.from({ length: 20 }).map((_, i) => ({
  id: `mem-${i}`,
  name: memberNames[i % 5],
  role: i === 0 ? "Admin" : i < 3 ? "Moderator" : "Member",
  joined: `202${(i % 3) + 1}-0${(i % 9) + 1}-15`,
  // Deterministic, realistic-looking values (no Math.random, stable across renders).
  posts: 37 + ((i * 53) % 460),
  reputation: 120 + ((i * 137) % 880),
  status: ["Active", "Banned", "Muted", "Active", "Active"][i % 5],
}));

type BadgeDef = { id: number; name: string; icon: LucideIcon; accent: string; desc: string };
const communityBadges: BadgeDef[] = [
  { id: 1, name: "Helpful Hero", icon: ThumbsUp, accent: "#2b6ef2", desc: "Received 100 upvotes" },
  { id: 2, name: "Solution Master", icon: CheckCircle, accent: "#2e7d32", desc: "Provided 50 accepted answers" },
  { id: 3, name: "Bug Hunter", icon: AlertTriangle, accent: "#c13c2c", desc: "Reported 10 confirmed bugs" },
  { id: 4, name: "Community Pillar", icon: Users, accent: "#7c3aed", desc: "Active for 1 consecutive year" },
];

const pointRules = [
  { action: "Creating a new topic", points: "+10", positive: true, limit: "5 per day" },
  { action: "Replying to a topic", points: "+2", positive: true, limit: "No limit" },
  { action: "Receiving an upvote", points: "+5", positive: true, limit: "No limit" },
  { action: "Having an answer accepted", points: "+15", positive: true, limit: "No limit" },
  { action: "Post deleted by moderator", points: "-20", positive: false, limit: "-" },
];

function roleTone(role: string): "accent" | "info" | "neutral" {
  if (role === "Admin") return "accent";
  if (role === "Moderator") return "info";
  return "neutral";
}

function statusTone(status: string): "success" | "danger" | "warning" {
  if (status === "Active") return "success";
  if (status === "Banned") return "danger";
  return "warning";
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState("forums");

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
            Community &amp; Forums
          </PageTitle>
          <PageDescription>
            Manage discussion boards, moderation queues, and user engagement.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="secondary" iconLeft={Eye}>
            View Live Forum
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            New Board
          </Button>
        </PageActions>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="forums">Boards &amp; Topics</TabsTrigger>
          <TabsTrigger value="moderation">Moderation Queue</TabsTrigger>
          <TabsTrigger value="members">Members &amp; Roles</TabsTrigger>
          <TabsTrigger value="gamification">Gamification</TabsTrigger>
        </TabsList>

        {/* Forums Tab */}
        <TabsContent value="forums" className="mt-6">
          <Card padding="none">
            <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between gap-4">
              <div className="max-w-md w-full">
                <Field>
                  <Input iconLeft={Search} placeholder="Search boards..." aria-label="Search boards" />
                </Field>
              </div>
              <Button variant="outline" iconLeft={Filter}>
                Filter
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {forums.map((forum) => (
                <Card key={forum.id} variant="interactive" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] flex items-center justify-center border border-[var(--st-border)]">
                        <MessageSquare className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--st-text)] flex items-center gap-2">
                          {forum.name}
                          {forum.pinned && <Badge tone="accent" kind="soft">Pinned</Badge>}
                        </h3>
                        <p className="text-[var(--st-text-secondary)] text-sm">{forum.desc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 md:gap-12">
                    <div className="flex gap-6 text-center">
                      <div>
                        <div className="text-lg font-bold text-[var(--st-text)]">{forum.topics.toLocaleString()}</div>
                        <div className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider">Topics</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-[var(--st-text)]">{forum.posts.toLocaleString()}</div>
                        <div className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider">Posts</div>
                      </div>
                    </div>

                    <div className="hidden md:block w-32 text-right">
                      <div className="text-sm text-[var(--st-text-secondary)]">Last Post</div>
                      <div className="text-xs text-[var(--st-text-tertiary)] flex items-center justify-end gap-1 mt-1">
                        <Clock className="w-3 h-3" aria-hidden="true" /> {forum.lastActive}
                      </div>
                    </div>

                    <IconButton label={`Settings for ${forum.name}`} icon={Settings} variant="ghost" />
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Moderation Tab */}
        <TabsContent value="moderation" className="mt-6">
          <Card padding="none">
            <CardHeader className="flex flex-row justify-between items-center gap-4">
              <div>
                <CardTitle>Moderation Queue</CardTitle>
                <CardDescription>Review flagged content and reported users.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Auto-Mod Rules</Button>
                <Button variant="secondary" size="sm">Clear All</Button>
              </div>
            </CardHeader>

            <div className="p-6 space-y-6">
              {flaggedPosts.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  tone="success"
                  title="The moderation queue is empty."
                  description="Nice work. Flagged content will appear here when reported."
                />
              ) : (
                flaggedPosts.map((post) => (
                  <Card
                    key={post.id}
                    className={
                      post.severity === "high"
                        ? "border-l-2 border-l-[var(--st-danger)]"
                        : "border-l-2 border-l-[var(--st-warn)]"
                    }
                  >
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)] flex items-center justify-center font-bold text-[var(--st-text-secondary)] border border-[var(--st-border)]">
                          {post.avatar}
                        </span>
                        <div>
                          <div className="font-medium text-[var(--st-text)]">{post.user}</div>
                          <div className="text-xs text-[var(--st-text-tertiary)] flex items-center gap-2">
                            <Flag className="w-3 h-3 text-[var(--st-danger)]" aria-hidden="true" />
                            Reported for: <span className="text-[var(--st-text-secondary)]">{post.reason}</span> . {post.date}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" iconLeft={CheckCircle}>
                          Ignore
                        </Button>
                        <Button variant="danger" size="sm" iconLeft={Trash2}>
                          Delete Post
                        </Button>
                        <IconButton label={`More actions for ${post.user}`} icon={MoreHorizontal} variant="outline" />
                      </div>
                    </div>

                    <div className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-4 text-[var(--st-text-secondary)] text-sm italic">
                      &quot;{post.content}&quot;
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button variant="ghost" size="sm" iconLeft={Ban}>
                        Ban User
                      </Button>
                      <Button variant="ghost" size="sm" iconLeft={MessageCircle}>
                        Send Warning
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <Card padding="none">
            <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="max-w-sm w-full">
                <Field>
                  <Input iconLeft={Search} placeholder="Search members..." aria-label="Search members" />
                </Field>
              </div>
              <div className="w-full sm:w-48">
                <Field>
                  <Select defaultValue="all">
                    <SelectTrigger aria-label="Filter by role">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admins">Admins</SelectItem>
                      <SelectItem value="moderators">Moderators</SelectItem>
                      <SelectItem value="members">Members</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <Table stickyHeader>
              <THead>
                <Tr>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Activity</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {members.map((member) => (
                  <Tr key={member.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-accent-soft)] flex items-center justify-center font-bold text-[var(--st-accent)] text-xs">
                          {member.name.substring(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium text-[var(--st-text)]">{member.name}</div>
                          <div className="text-xs text-[var(--st-text-tertiary)]">Joined {member.joined}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={roleTone(member.role)} kind="soft">
                        {member.role === "Admin" && <Shield className="w-3 h-3 mr-1" aria-hidden="true" />}
                        {member.role === "Moderator" && <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />}
                        {member.role}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="text-sm text-[var(--st-text-secondary)]">
                        <span className="font-medium text-[var(--st-text)]">{member.posts}</span> posts
                      </div>
                      <div className="text-xs text-[var(--st-status-ok)] flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3" aria-hidden="true" /> {member.reputation} rep
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={statusTone(member.status)} kind="soft">
                        {member.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <IconButton label={`More actions for ${member.name}`} icon={MoreHorizontal} variant="ghost" size="sm" />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            <div className="p-4 border-t border-[var(--st-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--st-text-secondary)]">
              <span>Showing 20 of 1,248 members</span>
              <Pagination page={1} pageCount={63} onPageChange={() => {}} />
            </div>
          </Card>
        </TabsContent>

        {/* Gamification Tab */}
        <TabsContent value="gamification" className="mt-6">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Engagement Score"
                value="84/100"
                icon={Activity}
                accent="#2e7d32"
                delta={{ value: "Excellent", tone: "up" }}
              />
              <StatCard
                label="Badges Awarded"
                value="1,432"
                icon={Award}
                accent="#2b6ef2"
                delta={{ value: "+124 this month", tone: "up" }}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-[var(--st-text-secondary)]">Top Contributor</CardTitle>
                </CardHeader>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-[var(--st-radius-pill)] bg-[var(--st-accent-soft)] border border-[var(--st-border)] flex items-center justify-center text-[var(--st-accent)] font-bold">
                    AC
                  </span>
                  <div>
                    <p className="font-bold text-[var(--st-text)]">Alice Cooper</p>
                    <p className="text-xs text-[var(--st-text-secondary)]">12.4k points</p>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[var(--st-border)] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--st-text)] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                    Badges &amp; Achievements
                  </h2>
                  <p className="text-sm text-[var(--st-text-secondary)] mt-1">Configure rewards for user behavior.</p>
                </div>
                <Button variant="outline" iconLeft={Plus}>
                  Create Badge
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {communityBadges.map((badge) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <Card key={badge.id} variant="interactive" className="flex items-start gap-4">
                      <span
                        className="w-12 h-12 rounded-[var(--st-radius-lg)] flex items-center justify-center text-white shrink-0"
                        style={{ background: badge.accent }}
                      >
                        <BadgeIcon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-[var(--st-text)]">{badge.name}</h4>
                        <p className="text-sm text-[var(--st-text-secondary)] mt-1">{badge.desc}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs font-medium">
                          <span className="text-[var(--st-text-tertiary)]">Level 1+</span>
                          <span className="text-[var(--st-accent)]">Awarded to 45 users</span>
                        </div>
                      </div>
                      <IconButton label={`Edit ${badge.name}`} icon={Pencil} variant="ghost" size="sm" />
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[var(--st-text)] mb-6 border-b border-[var(--st-border)] pb-4">
                Point System Rules
              </h2>
              <Card padding="none">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Action</Th>
                      <Th>Points</Th>
                      <Th>Limit</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {pointRules.map((rule) => (
                      <Tr key={rule.action}>
                        <Td>{rule.action}</Td>
                        <Td>
                          <Badge tone={rule.positive ? "success" : "danger"} kind="soft">
                            {rule.points}
                          </Badge>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">{rule.limit}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
