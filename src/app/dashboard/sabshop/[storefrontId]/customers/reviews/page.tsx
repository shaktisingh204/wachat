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
  Package,
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
} from "@/components/sabcrm/20ui";

const mockReviews = [
  {
    id: "rev_1",
    product: { name: "Aura pro sneakers" },
    customer: { name: "Aanya Sharma", email: "aanya.s@example.com" },
    rating: 5,
    title: "Best sneakers I have owned",
    content:
      "Incredible comfort and they look exactly like the pictures. I have worn them daily for a week without any issues.",
    status: "Approved",
    date: "Jun 2, 2026",
    verified: true,
  },
  {
    id: "rev_2",
    product: { name: "Classic denim jacket" },
    customer: { name: "Sarah Miller", email: "sarah.m@example.com" },
    rating: 2,
    title: "Sizing runs small",
    content:
      "I ordered a medium but it fits like an extra small. The material is nice but I cannot button it. Disappointed.",
    status: "Pending",
    date: "Jun 3, 2026",
    verified: true,
  },
  {
    id: "rev_3",
    product: { name: "Minimalist watch" },
    customer: { name: "Mike Donovan", email: "mike.d@spamdomain.com" },
    rating: 1,
    title: "Stopped working after two days",
    content: "Broke after two days and support has not responded to my emails. Would not recommend.",
    status: "Rejected",
    date: "Jun 1, 2026",
    verified: false,
  },
  {
    id: "rev_4",
    product: { name: "Ceramic coffee mug" },
    customer: { name: "Emma Wilson", email: "emma.w@example.com" },
    rating: 4,
    title: "Lovely design",
    content:
      "A really nice mug that keeps my coffee warm. Giving four stars because shipping took longer than expected.",
    status: "Pending",
    date: "Jun 3, 2026",
    verified: true,
  },
  {
    id: "rev_5",
    product: { name: "Leather backpack" },
    customer: { name: "David Chen", email: "d.chen@example.com" },
    rating: 5,
    title: "Perfect for commuting",
    content: "Fits my 15-inch laptop perfectly. The leather is premium and it has held up well. Worth it.",
    status: "Approved",
    date: "May 28, 2026",
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
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <Star
            key={star}
            aria-hidden="true"
            className="h-3.5 w-3.5"
            style={{
              fill: filled ? "var(--st-warn)" : "var(--st-bg-muted)",
              color: filled ? "var(--st-warn)" : "var(--st-border-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

export default function ReviewsModerationPage() {
  const [filter, setFilter] = useState<string>("All");

  const filteredReviews = mockReviews.filter((r) => filter === "All" || r.status === filter);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeaderBlock />

      <section aria-label="Review summary" className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Pending review"
          value={<span className="tabular-nums">24</span>}
          icon={ShieldAlert}
          accent="#d97706"
          delta={{ value: "Needs action", tone: "neutral" }}
        />
        <StatCard
          label="Approved today"
          value={<span className="tabular-nums">142</span>}
          icon={CheckCircle}
          accent="#1f9d55"
          delta={{ value: "+12% vs yesterday", tone: "up" }}
        />
        <StatCard
          label="Average rating"
          value={
            <span className="inline-flex items-center gap-2 tabular-nums">
              4.8
              <RatingStars rating={5} />
            </span>
          }
          icon={Star}
          accent="#7c3aed"
        />
        <StatCard
          label="Positive sentiment"
          value={<span className="tabular-nums">92%</span>}
          icon={MessageSquare}
          accent="#3b7af5"
          delta={{ value: "Up this week", tone: "up" }}
        />
      </section>

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
              <Input placeholder="Search reviews" iconLeft={Search} inputSize="sm" aria-label="Search reviews" />
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
                  <Th width={300}>Review and product</Th>
                  <Th>Customer</Th>
                  <Th>Rating</Th>
                  <Th>Status</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filteredReviews.map((review) => (
                  <Tr key={review.id} className="group">
                    <Td className="align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] ring-1 ring-inset ring-[var(--st-border)]"
                            aria-hidden="true"
                          >
                            <Package size={14} />
                          </span>
                          <span className="w-48 truncate text-xs font-medium text-[var(--st-text-secondary)]">
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
                        <Avatar name={review.customer.name} shape="round" size="sm" />
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1 text-sm font-medium text-[var(--st-text)]">
                            {review.customer.name}
                            {review.verified && (
                              <CheckCircle
                                className="h-3 w-3 text-[var(--st-status-ok)]"
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
        <PageTitle>Reviews</PageTitle>
        <PageDescription>
          Monitor, approve, and reply to product reviews from your customers.
        </PageDescription>
      </PageHeaderHeading>
      <PageActions>
        <Button variant="outline" iconLeft={ShieldAlert}>
          Auto-moderation rules
        </Button>
      </PageActions>
    </PageHeader>
  );
}
