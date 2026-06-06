"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  MoreVertical,
  Star,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Button,
  IconButton,
  Badge,
  type BadgeTone,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Field,
  Input,
  SegmentedControl,
  EmptyState,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/sabcrm/20ui";

const mockReviews = [
  {
    id: "rev_1",
    product: {
      name: "SabShop Pro Sneakers",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop",
    },
    customer: {
      name: "Alex Johnson",
      email: "alex@example.com",
      avatar: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    },
    rating: 5,
    title: "Best sneakers ever!",
    content:
      "Incredible comfort and they look exactly like the pictures. I've been wearing them daily for a week without any issues.",
    status: "Approved",
    date: "2026-06-02",
    verified: true,
  },
  {
    id: "rev_2",
    product: {
      name: "Classic Denim Jacket",
      image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=100&h=100&fit=crop",
    },
    customer: {
      name: "Sarah Miller",
      email: "sarah.m@example.com",
      avatar: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
    },
    rating: 2,
    title: "Sizing is way off",
    content:
      "I ordered a medium but it fits like an extra small. The material is nice but I can't even button it. Disappointed.",
    status: "Pending",
    date: "2026-06-03",
    verified: true,
  },
  {
    id: "rev_3",
    product: {
      name: "Minimalist Watch",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop",
    },
    customer: {
      name: "Mike Donovan",
      email: "mike.d@spamdomain.com",
      avatar: "",
    },
    rating: 1,
    title: "Terrible quality do not buy!!!",
    content: "Broke after 2 days. The company won't respond to my emails. Scam!!! #worstpurchase",
    status: "Rejected",
    date: "2026-06-01",
    verified: false,
  },
  {
    id: "rev_4",
    product: {
      name: "Ceramic Coffee Mug",
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=100&h=100&fit=crop",
    },
    customer: {
      name: "Emma Wilson",
      email: "emma.w@example.com",
      avatar: "https://i.pravatar.cc/150?u=a04258114e29026322d",
    },
    rating: 4,
    title: "Lovely design",
    content:
      "Really cute mug, keeps my coffee warm. Only giving 4 stars because shipping took longer than expected.",
    status: "Pending",
    date: "2026-06-03",
    verified: true,
  },
  {
    id: "rev_5",
    product: {
      name: "Leather Backpack",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=100&h=100&fit=crop",
    },
    customer: {
      name: "David Chen",
      email: "d.chen@example.com",
      avatar: "https://i.pravatar.cc/150?u=333",
    },
    rating: 5,
    title: "Perfect for commuting",
    content: "Fits my 15 inch laptop perfectly. The leather is premium and smells great. Worth every penny.",
    status: "Approved",
    date: "2026-05-28",
    verified: true,
  },
];

const STATUS_FILTERS = [
  { value: "All", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`w-3.5 h-3.5 ${
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-[var(--st-bg-muted)] text-[var(--st-border-strong)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsModerationPage() {
  const [filter, setFilter] = useState<string>("All");

  const filteredReviews = mockReviews.filter((r) => filter === "All" || r.status === filter);

  return (
    <div className="ui20 flex w-full flex-col gap-6 p-6">
      <PageHeaderBlock />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Pending Review"
          value="24"
          icon={ShieldAlert}
          accent="var(--st-warn)"
          delta={{ value: "Needs action", tone: "neutral" }}
        />
        <StatCard label="Approved Today" value="142" delta={{ value: "+12%", tone: "up" }} />
        <StatCard
          label="Average Rating"
          value={
            <span className="inline-flex items-center gap-2">
              4.8
              <RatingStars rating={5} />
            </span>
          }
        />
        <StatCard label="AI Sentiment" value="92%" delta={{ value: "Positive", tone: "up" }} />
      </div>

      <Card padding="none" className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="overflow-x-auto pb-2 sm:pb-0">
            <SegmentedControl
              aria-label="Filter reviews by status"
              items={STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
              value={filter}
              onChange={setFilter}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Field className="w-full sm:w-64">
              <Input placeholder="Search reviews..." iconLeft={Search} inputSize="sm" aria-label="Search reviews" />
            </Field>
            <IconButton label="More filters" icon={Filter} variant="outline" size="sm" className="shrink-0" />
          </div>
        </CardHeader>
        <CardBody className="p-0 flex-1 overflow-auto">
          {filteredReviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No reviews here"
              description="No reviews match this status filter yet. Try a different filter."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th width={300}>Review & Product</Th>
                  <Th>Customer</Th>
                  <Th>Rating</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredReviews.map((review) => (
                  <Tr key={review.id} className="group">
                    <Td className="align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={review.product.image}
                            alt={review.product.name}
                            className="w-8 h-8 rounded-[var(--st-radius-sm)] object-cover border border-[var(--st-border)]"
                          />
                          <span className="text-xs font-medium text-[var(--st-text-secondary)] truncate w-48">
                            {review.product.name}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--st-text)] mb-1">{review.title}</h4>
                          <p className="text-sm text-[var(--st-text-tertiary)] line-clamp-2 leading-relaxed">
                            &ldquo;{review.content}&rdquo;
                          </p>
                        </div>
                        <span className="text-xs text-[var(--st-text-secondary)]">{review.date}</span>
                      </div>
                    </Td>

                    <Td className="align-top">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={review.customer.avatar} alt={review.customer.name} />
                          <AvatarFallback>{review.customer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--st-text)] flex items-center gap-1">
                            {review.customer.name}
                            {review.verified && (
                              <CheckCircle
                                className="w-3 h-3 text-[var(--st-status-ok)]"
                                aria-label="Verified buyer"
                              />
                            )}
                          </span>
                          <span className="text-xs text-[var(--st-text-secondary)]">{review.customer.email}</span>
                        </div>
                      </div>
                    </Td>

                    <Td className="align-top">
                      <RatingStars rating={review.rating} />
                    </Td>

                    <Td className="align-top">
                      <Badge tone={STATUS_TONE[review.status] ?? "neutral"}>{review.status}</Badge>
                    </Td>

                    <Td align="right" className="align-top">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {review.status === "Pending" && (
                          <>
                            <IconButton
                              label="Approve review"
                              icon={CheckCircle}
                              variant="ghost"
                              size="sm"
                            />
                            <IconButton label="Reject review" icon={XCircle} variant="ghost" size="sm" />
                          </>
                        )}
                        <IconButton label="Reply to review" icon={MessageSquare} variant="ghost" size="sm" />
                        <IconButton label="More actions" icon={MoreVertical} variant="ghost" size="sm" />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PageHeaderBlock() {
  return (
    <PageHeader>
      <PageHeaderHeading>
        <PageTitle className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[var(--st-accent)]" aria-hidden="true" />
          Reviews Moderation
        </PageTitle>
        <PageDescription>
          Centralized hub for monitoring, approving, and replying to product reviews.
        </PageDescription>
      </PageHeaderHeading>
      <PageActions>
        <Button variant="outline" iconLeft={ShieldAlert}>
          Auto-Moderation Rules
        </Button>
      </PageActions>
    </PageHeader>
  );
}
