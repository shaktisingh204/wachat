
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export function MapBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-4">
             <Alert>
                <MapPin className="h-4 w-4" />
                <AlertTitle>Google Maps API Key Required</AlertTitle>
                <AlertDescription>
                    To display maps, you must add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_API_KEY"` to your `.env.local` file.
                </AlertDescription>
            </Alert>
            <Accordion type="multiple" className="w-full" defaultValue={['location', 'display']}>
                <AccordionItem value="location">
                    <AccordionTrigger>Location</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Address or Place Name</Label>
                            <Input
                                value={settings.address || ''}
                                onChange={(e) => handleUpdate('address', e.target.value)}
                                placeholder="e.g., Eiffel Tower, Paris, France"
                            />
                             <p className="text-xs text-muted-foreground">This is used if Latitude/Longitude are not provided.</p>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="display">
                    <AccordionTrigger>Display Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Map Type</Label>
                            <Select value={settings.mapType || 'roadmap'} onValueChange={(val) => handleUpdate('mapType', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="roadmap">Roadmap</SelectItem>
                                    <SelectItem value="satellite">Satellite</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Zoom Level</Label>
                                <span className="text-sm text-muted-foreground">{settings.zoom || 14}</span>
                            </div>
                            <Slider
                                value={[settings.zoom || 14]}
                                onValueChange={(val) => handleUpdate('zoom', val[0])}
                                min={1}
                                max={20}
                                step={1}
                            />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input value={settings.width || '100%'} onChange={(e) => handleUpdate('width', e.target.value)} placeholder="e.g. 100% or 600px"/>
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input value={settings.height || '450px'} onChange={(e) => handleUpdate('height', e.target.value)} placeholder="e.g. 450px" />
                            </div>
                         </div>
                         <div className="flex items-center space-x-2 pt-2">
                            <Switch id="roundedCorners" checked={settings.rounded || false} onCheckedChange={(val) => handleUpdate('rounded', val)} />
                            <Label htmlFor="roundedCorners">Rounded Corners</Label>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
