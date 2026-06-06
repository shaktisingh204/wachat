'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Textarea,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { addKeyword } from '@/app/actions/seo-rank.actions';
import { toast } from '@/hooks/use-toast';

export function AddKeywordDialog({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [keywords, setKeywords] = useState('');
    const [location, setLocation] = useState('2840'); // Default US

    const handleSubmit = async () => {
        if (!keywords.trim()) return;

        setLoading(true);
        // Split by lines
        const list = keywords.split(/\n/).map(k => k.trim()).filter(k => k.length > 0);

        // Process sequentially (could be parallel)
        let addedCount = 0;

        for (const kw of list) {
            try {
                const res = await addKeyword(projectId, kw, location);
                if (res.success) addedCount++;
            } catch (e) {
                console.error(e);
            }
        }

        setLoading(false);
        setOpen(false);
        setKeywords('');
        toast({ title: "Keywords Added", description: `Successfully added ${addedCount} keywords.` });
        onAdded();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Keywords
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Add Keywords to Track</ZoruDialogTitle>
                </ZoruDialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Location</Label>
                        <Select value={location} onValueChange={setLocation}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select Location" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="2840">United States</ZoruSelectItem>
                                <ZoruSelectItem value="2826">United Kingdom</ZoruSelectItem>
                                <ZoruSelectItem value="2356">India</ZoruSelectItem>
                                <ZoruSelectItem value="2036">Australia</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Keywords (One per line)</Label>
                        <Textarea
                            placeholder="seo tools&#10;rank tracker"
                            className="h-32"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                        />
                    </div>
                </div>

                <Button onClick={handleSubmit} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add Keywords
                </Button>
            </ZoruDialogContent>
        </Dialog>
    );
}
