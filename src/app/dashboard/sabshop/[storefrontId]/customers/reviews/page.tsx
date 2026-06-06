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
  StarHalf,
  ShieldAlert,
  ThumbsUp,
  ExternalLink
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/zoruui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/zoruui/table";
import { Button } from "@/components/zoruui/button";
import { Badge } from "@/components/zoruui/badge";
import { Input } from "@/components/zoruui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/zoruui/avatar";

const mockReviews = [
  {
    id: "rev_1",
    product: {
      name: "SabShop Pro Sneakers",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop"
    },
    customer: {
      name: "Alex Johnson",
      email: "alex@example.com",
      avatar: "https://i.pravatar.cc/150?u=a042581f4e29026024d"
    },
    rating: 5,
    title: "Best sneakers ever!",
    content: "Incredible comfort and they look exactly like the pictures. I've been wearing them daily for a week without any issues.",
    status: "Approved",
    date: "2026-06-02",
    verified: true
  },
  {
    id: "rev_2",
    product: {
      name: "Classic Denim Jacket",
      image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=100&h=100&fit=crop"
    },
    customer: {
      name: "Sarah Miller",
      email: "sarah.m@example.com",
      avatar: "https://i.pravatar.cc/150?u=a04258a2462d826712d"
    },
    rating: 2,
    title: "Sizing is way off",
    content: "I ordered a medium but it fits like an extra small. The material is nice but I can't even button it. Disappointed.",
    status: "Pending",
    date: "2026-06-03",
    verified: true
  },
  {
    id: "rev_3",
    product: {
      name: "Minimalist Watch",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop"
    },
    customer: {
      name: "Mike Donovan",
      email: "mike.d@spamdomain.com",
      avatar: ""
    },
    rating: 1,
    title: "Terrible quality do not buy!!!",
    content: "Broke after 2 days. The company won't respond to my emails. Scam!!! #worstpurchase",
    status: "Rejected",
    date: "2026-06-01",
    verified: false
  },
  {
    id: "rev_4",
    product: {
      name: "Ceramic Coffee Mug",
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=100&h=100&fit=crop"
    },
    customer: {
      name: "Emma Wilson",
      email: "emma.w@example.com",
      avatar: "https://i.pravatar.cc/150?u=a04258114e29026322d"
    },
    rating: 4,
    title: "Lovely design",
    content: "Really cute mug, keeps my coffee warm. Only giving 4 stars because shipping took longer than expected.",
    status: "Pending",
    date: "2026-06-03",
    verified: true
  },
  {
    id: "rev_5",
    product: {
      name: "Leather Backpack",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=100&h=100&fit=crop"
    },
    customer: {
      name: "David Chen",
      email: "d.chen@example.com",
      avatar: "https://i.pravatar.cc/150?u=333"
    },
    rating: 5,
    title: "Perfect for commuting",
    content: "Fits my 15 inch laptop perfectly. The leather is premium and smells great. Worth every penny.",
    status: "Approved",
    date: "2026-05-28",
    verified: true
  }
];

const RatingStars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star 
          key={star} 
          className={`w-3.5 h-3.5 ${star <= rating ? "fill-amber-400 text-amber-400" : "fill-[var(--st-bg-muted)] text-[var(--st-border-strong)]"}`} 
        />
      ))}
    </div>
  );
};

export default function ReviewsModerationPage() {
  const [filter, setFilter] = useState("All");

  const filteredReviews = mockReviews.filter(r => filter === "All" || r.status === filter);

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)] tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-pink-500" />
            Reviews Moderation
          </h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Centralized hub for monitoring, approving, and replying to product reviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Auto-Moderation Rules
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-none border-[var(--st-border)]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-[var(--st-text-secondary)] mb-1">Pending Review</p>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold text-amber-500">24</h2>
              <span className="text-xs font-medium px-2 py-1 bg-amber-500/10 text-amber-600 rounded-full flex items-center gap-1">
                Needs action
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[var(--st-border)]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-[var(--st-text-secondary)] mb-1">Approved Today</p>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold text-[var(--st-text)]">142</h2>
              <span className="text-xs font-medium text-emerald-500">+12%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[var(--st-border)]">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-[var(--st-text-secondary)] mb-1">Average Rating</p>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold text-[var(--st-text)]">4.8</h2>
              <RatingStars rating={5} />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[var(--st-border)] bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-indigo-600 mb-1">AI Sentiment</p>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold text-indigo-700">92%</h2>
              <span className="text-xs font-medium text-indigo-600">Positive</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="border-b border-[var(--st-border)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {["All", "Pending", "Approved", "Rejected"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(status)}
                className={`rounded-full h-8 ${filter === status ? "bg-[var(--st-text)] text-[var(--st-bg)]" : "border-[var(--st-border)]"}`}
              >
                {status}
                {status === "Pending" && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${filter === status ? "bg-[var(--st-bg)] text-[var(--st-text)]" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500"}`}>
                    24
                  </span>
                )}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--st-text-secondary)]" />
              <Input placeholder="Search reviews..." className="pl-9 h-9" />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Review & Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReviews.map((review) => (
                <TableRow key={review.id} className="group items-start">
                  <TableCell className="align-top py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <img 
                          src={review.product.image} 
                          alt={review.product.name} 
                          className="w-8 h-8 rounded-[var(--zoru-radius-sm)] object-cover border border-[var(--st-border)]"
                        />
                        <span className="text-xs font-medium text-[var(--st-text-secondary)] truncate w-48">
                          {review.product.name}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--st-text)] mb-1">{review.title}</h4>
                        <p className="text-sm text-[var(--st-text-tertiary)] line-clamp-2 leading-relaxed">
                          "{review.content}"
                        </p>
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)]">{review.date}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="align-top py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={review.customer.avatar} />
                        <AvatarFallback>{review.customer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-[var(--st-text)] flex items-center gap-1">
                          {review.customer.name}
                          {review.verified && (
                            <CheckCircle className="w-3 h-3 text-indigo-500" />
                          )}
                        </span>
                        <span className="text-xs text-[var(--st-text-secondary)]">{review.customer.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="align-top py-4">
                    <RatingStars rating={review.rating} />
                  </TableCell>
                  
                  <TableCell className="align-top py-4">
                    <Badge 
                      variant={
                        review.status === "Approved" ? "default" :
                        review.status === "Pending" ? "outline" : "secondary"
                      }
                      className={
                        review.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" :
                        review.status === "Pending" ? "bg-amber-500/10 text-amber-600 border-transparent" :
                        "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                      }
                    >
                      {review.status}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="align-top py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {review.status === "Pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-700">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-700">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MessageSquare className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
