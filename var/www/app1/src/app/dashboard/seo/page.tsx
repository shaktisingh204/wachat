
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Radar, LayoutGrid, Globe, AreaChart, Link as LinkIcon, Users, Mail, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';


const FeatureCard = ({ icon: Icon, title, description, children }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode }) => (
    <Card className="flex flex-col h-full card-gradient card-gradient-orange">
        <CardHeader>
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary"/>
                </div>
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="flex-grow">
            {children}
        </CardContent>
    </Card>
);

const StatItem = ({ label, value, change, changeType }: { label: string, value: string, change?: string, changeType?: 'increase' | 'decrease' }) => (
    <div className="flex justify-between items-baseline">
        <p className="text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
            <p className="text-xl font-bold">{value}</p>
            {change && (
                <Badge variant={changeType === 'increase' ? 'default' : 'destructive'} className="text-xs">{change}</Badge>
            )}
        </div>
    </div>
);

export default function SeoDashboardPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <TrendingUp className="h-8 w-8"/>
                    SEO Suite Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                    An overview of your website's SEO health, brand presence, and performance metrics.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Brand Radar */}
                <FeatureCard 
                    icon={Radar}
                    title="Brand Radar"
                    description="Track brand mentions and sentiment across the web."
                >
                    <div className="space-y-4">
                        <StatItem label="Total Mentions (7d)" value="1,284" change="+15%" changeType="increase"/>
                        <StatItem label="Positive Sentiment" value="78%" change="+2%" changeType="increase"/>
                        <StatItem label="Competitor Mentions" value="891" change="-5%" changeType="decrease"/>
                        <Separator />
                        <p className="text-sm font-semibold">Mention Sources</p>
                        <div className="flex items-center justify-around text-muted-foreground">
                            <div className="text-center"><Users className="h-6 w-6 mx-auto mb-1"/><span className="text-xs">Social</span></div>
                            <div className="text-center"><Mail className="h-6 w-6 mx-auto mb-1"/><span className="text-xs">News</span></div>
                            <div className="text-center"><MessageCircle className="h-6 w-6 mx-auto mb-1"/><span className="text-xs">Forums</span></div>
                        </div>
                    </div>
                </FeatureCard>
                
                {/* Performance Dashboard */}
                 <FeatureCard 
                    icon={LayoutGrid}
                    title="Performance Dashboard"
                    description="Your customizable hub for key SEO metrics."
                >
                     <div className="space-y-4">
                        <StatItem label="Organic Traffic" value="24.1k" change="+8.2%" changeType="increase"/>
                        <StatItem label="Keywords in Top 10" value="1,452" change="+56" changeType="increase"/>
                        <StatItem label="Avg. Position" value="12.4" change="-0.8" changeType="increase"/>
                         <div className="pt-2">
                            <Button variant="outline" className="w-full">Customize Widgets</Button>
                         </div>
                    </div>
                </FeatureCard>

                {/* Site Explorer */}
                 <FeatureCard 
                    icon={Globe}
                    title="Site Explorer"
                    description="Analyze domain-level metrics and backlink profile."
                >
                     <div className="space-y-4">
                        <StatItem label="Domain Authority" value="58" />
                        <StatItem label="Referring Domains" value="2,104" change="+112" changeType="increase" />
                        <StatItem label="Total Backlinks" value="48.7k" />
                        <Separator />
                        <div className="text-sm">
                            <p className="font-semibold mb-2">Top Anchor Text</p>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">SabNode</Badge>
                                <Badge variant="secondary">WhatsApp Marketing</Badge>
                                <Badge variant="secondary">SEO Suite</Badge>
                            </div>
                        </div>
                    </div>
                </FeatureCard>
            </div>
        </div>
    );
}

