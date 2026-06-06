'use client';

import { useState } from 'react';
import {
  Card,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardFooter,
  Badge,
  Button,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Input,
  Textarea,
  Label,
  useZoruToast,
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui/compat';
import { Star, CheckCircle2, Briefcase, MapPin, Search, SlidersHorizontal } from 'lucide-react';

const MOCK_EXPERTS = [
  {
    id: "1",
    name: "Sarah Jenkins",
    title: "Technical SEO Specialist",
    rating: 4.9,
    reviews: 124,
    rate: "$85/hr",
    location: "New York, USA",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    skills: ["Core Web Vitals", "Next.js", "Site Architecture", "Schema Markup"],
    description: "Specializing in technical SEO for modern JavaScript frameworks. I can help you fix those tricky hydration and rendering issues impacting your search visibility.",
    verified: true,
  },
  {
    id: "2",
    name: "Marcus Thorne",
    title: "Content Strategist & SEO",
    rating: 4.8,
    reviews: 89,
    rate: "$65/hr",
    location: "London, UK",
    avatar: "https://i.pravatar.cc/150?u=marcus",
    skills: ["Keyword Research", "Content Audits", "Link Building", "Copywriting"],
    description: "I help brands scale their organic traffic through data-driven content strategies and high-quality editorial planning.",
    verified: true,
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    title: "E-commerce SEO Expert",
    rating: 5.0,
    reviews: 210,
    rate: "$95/hr",
    location: "Remote",
    avatar: "https://i.pravatar.cc/150?u=elena",
    skills: ["Shopify SEO", "Product Optimization", "Conversion Rate", "Technical SEO"],
    description: "Driven e-commerce specialist with a proven track record of increasing organic revenue for online stores.",
    verified: true,
  },
  {
    id: "4",
    name: "David Chen",
    title: "Local SEO Consultant",
    rating: 4.7,
    reviews: 56,
    rate: "$50/hr",
    location: "Toronto, CA",
    avatar: "https://i.pravatar.cc/150?u=david",
    skills: ["Google Business Profile", "Citation Building", "Local Pack", "Review Management"],
    description: "Helping brick-and-mortar businesses dominate their local search results and drive more foot traffic.",
    verified: false,
  }
];

function ExpertCard({ expert }: { expert: typeof MOCK_EXPERTS[0] }) {
    const { toast } = useZoruToast();
    const [open, setOpen] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setOpen(false);
        toast({
            title: "Message sent",
            description: `Your message to ${expert.name} has been sent successfully.`,
        });
    };

    return (
        <Card className="flex flex-col">
            <ZoruCardHeader className="flex flex-row items-start gap-4 pb-4">
                <Avatar className="h-16 w-16 border">
                    <ZoruAvatarImage src={expert.avatar} alt={expert.name} />
                    <ZoruAvatarFallback>{expert.name.substring(0, 2)}</ZoruAvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-start justify-between">
                        <div>
                            <ZoruCardTitle className="flex items-center gap-1.5 text-lg">
                                {expert.name}
                                {expert.verified && (
                                    <CheckCircle2 className="h-4 w-4 text-zoru-ink" />
                                )}
                            </ZoruCardTitle>
                            <p className="text-sm text-zoru-ink-muted">{expert.title}</p>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold text-zoru-ink">{expert.rate}</div>
                        </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-3 text-sm text-zoru-ink-muted">
                        <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-zoru-ink-muted text-zoru-ink-muted" />
                            <span className="font-medium text-zoru-ink">{expert.rating}</span>
                            <span>({expert.reviews})</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{expert.location}</span>
                        </div>
                    </div>
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 pb-4">
                <ZoruCardDescription className="line-clamp-3 text-sm text-zoru-ink-muted">
                    {expert.description}
                </ZoruCardDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                    {expert.skills.map(skill => (
                        <Badge key={skill} variant="secondary">
                            {skill}
                        </Badge>
                    ))}
                </div>
            </ZoruCardContent>
            <ZoruCardFooter className="pt-0">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full gap-2">
                            <Briefcase className="h-4 w-4" />
                            Contact {expert.name.split(' ')[0]}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Contact {expert.name}</DialogTitle>
                            <DialogDescription>
                                Send a message to discuss your SEO needs. {expert.name} typically responds within 24 hours.
                            </DialogDescription>
                        </DialogHeader>
                        <form className="space-y-4 py-4" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor={`subject-${expert.id}`}>Subject</Label>
                                <Input id={`subject-${expert.id}`} placeholder="What do you need help with?" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`message-${expert.id}`}>Message</Label>
                                <Textarea id={`message-${expert.id}`} placeholder={`Hi ${expert.name.split(' ')[0]},\n\nI'm looking for help with...`} className="min-h-[120px]" required />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">Cancel</Button>
                                </DialogClose>
                                <Button type="submit">Send Message</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </ZoruCardFooter>
        </Card>
    );
}

export default function ExpertsDirectoryPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSkill, setSelectedSkill] = useState<string>("All");
    const [sortBy, setSortBy] = useState<string>("rating");

    const allSkills = Array.from(new Set(MOCK_EXPERTS.flatMap(expert => expert.skills))).sort();

    const filteredExperts = MOCK_EXPERTS.filter(expert => {
        const matchesSearch = expert.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              expert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              expert.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSkill = selectedSkill === "All" || expert.skills.includes(selectedSkill);
        return matchesSearch && matchesSkill;
    }).sort((a, b) => {
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "reviews") return b.reviews - a.reviews;
        
        // Extract numeric rate for sorting (assuming format like "$85/hr")
        const rateA = parseInt(a.rate.replace(/[^0-9]/g, '')) || 0;
        const rateB = parseInt(b.rate.replace(/[^0-9]/g, '')) || 0;
        
        if (sortBy === "rate-low") return rateA - rateB;
        if (sortBy === "rate-high") return rateB - rateA;
        return 0;
    });

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="max-w-2xl">
                    <h1 className="text-3xl font-semibold text-zoru-ink">Hire a Vetted Expert</h1>
                    <p className="text-zoru-ink-muted mt-2">
                        Need help fixing those Critical Issues? Match with a pro who knows this platform.
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center bg-zoru-surface border border-zoru-border p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                    <Input 
                        placeholder="Search by name, title, or keyword..." 
                        className="pl-9 w-full bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-white">
                            <SlidersHorizontal className="h-4 w-4 mr-2 opacity-50" />
                            <SelectValue placeholder="Filter by Skill" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Skills</SelectItem>
                            {allSkills.map(skill => (
                                <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-white">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="rating">Highest Rated</SelectItem>
                            <SelectItem value="reviews">Most Reviews</SelectItem>
                            <SelectItem value="rate-low">Lowest Rate</SelectItem>
                            <SelectItem value="rate-high">Highest Rate</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {filteredExperts.length === 0 ? (
                <div className="text-center py-16 px-4 border border-dashed border-zoru-border rounded-xl bg-zoru-surface/50">
                    <div className="mx-auto w-12 h-12 rounded-full bg-zoru-surface border border-zoru-border flex items-center justify-center mb-4">
                        <Search className="h-6 w-6 text-zoru-ink-muted" />
                    </div>
                    <h3 className="text-lg font-medium text-zoru-ink mb-1">No experts found</h3>
                    <p className="text-zoru-ink-muted max-w-sm mx-auto">
                        We couldn't find any experts matching your current search criteria. Try adjusting your filters or search term.
                    </p>
                    <Button 
                        variant="outline" 
                        className="mt-6"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedSkill("All");
                            setSortBy("rating");
                        }}
                    >
                        Clear all filters
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
                    {filteredExperts.map(expert => (
                        <ExpertCard key={expert.id} expert={expert} />
                    ))}
                </div>
            )}
        </div>
    );
}
