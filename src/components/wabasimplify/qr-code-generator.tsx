'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LoaderCircle, QrCode, Link as LinkIcon, Type, Mail, Phone, Wifi, MessageSquare, Download, Save, RefreshCw, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createQrCode } from '@/app/actions/qr-code.actions';
import { QrCodeRenderer } from './qr-code-renderer';
import { SketchPicker } from 'react-color';
import type { User, Tag } from '@/lib/definitions';
import { MultiSelectCombobox } from './multi-select-combobox'; // Assuming this exists from previous file
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { downloadQrCode } from '@/lib/qr-utils';

const DATA_TYPES = [
    { value: 'url', label: 'Website', icon: LinkIcon },
    { value: 'text', label: 'Plain Text', icon: Type },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'wifi', label: 'WiFi', icon: Wifi },
];

export function QrCodeGenerator({ user }: { user: Omit<User, 'password'> & { _id: string, tags?: Tag[] } }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Core Data State
    const [dataType, setDataType] = useState('url');
    const [name, setName] = useState('');
    const [tagIds, setTagIds] = useState<string[]>([]);

    // Type specific data
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const [email, setEmail] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [phone, setPhone] = useState('');
    const [sms, setSms] = useState('');
    const [smsMessage, setSmsMessage] = useState('');
    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPassword, setWifiPassword] = useState('');
    const [wifiEncryption, setWifiEncryption] = useState('WPA');
    const [wifiHidden, setWifiHidden] = useState(false);

    // Design State
    const [dotColor, setDotColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [eccLevel, setEccLevel] = useState('L'); // L, M, Q, H
    const [logoDataUri, setLogoDataUri] = useState<string | undefined>(undefined);
    const [isDynamic, setIsDynamic] = useState(true);

    const qrWrapperRef = useRef<HTMLDivElement>(null);

    // Computed QR Value
    const getQrValue = () => {
        switch (dataType) {
            case 'url': return url || 'https://example.com';
            case 'text': return text || 'Example Text';
            case 'email': return `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            case 'phone': return `tel:${phone}`;
            case 'sms': return `smsto:${sms}:${encodeURIComponent(smsMessage)}`;
            case 'wifi': return `WIFI:T:${wifiEncryption};S:${wifiSsid};P:${wifiPassword};H:${wifiHidden};;`;
            default: return '';
        }
    };

    const qrValue = getQrValue();

    // Handlers
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 200 * 1024) { // 200KB limit
                toast({ title: 'File too large', description: 'Logo must be under 200KB', variant: 'destructive' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setLogoDataUri(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDownload = async (format: 'png' | 'svg') => {
        const svg = qrWrapperRef.current?.querySelector('svg');
        if (!svg) return;

        // Use shared utility
        await downloadQrCode(svg, {
            filename: `qrcode-${name || 'untitled'}`,
            format,
            bgColor,
            logoDataUri,
            size: 256 // Matches the visual size logic mostly, will be scaled up by utility
        });
    };

    const handleSave = async () => {
        if (!name) {
            toast({ title: 'Name required', description: 'Please give your QR code a name.', variant: 'destructive' });
            return;
        }

        const dataPayload = {
            url, text, email, emailSubject, emailBody, phone, sms, smsMessage,
            wifiSsid, wifiPassword, wifiEncryption, wifiHidden
        };

        const configPayload = {
            color: dotColor,
            bgColor,
            eccLevel,
            logoDataUri // We might want to upload this to S3/Cloudinary in real app, but storing string for now as per legacy
        };

        const formData = new FormData();
        formData.append('name', name);
        formData.append('dataType', dataType);
        formData.append('data', JSON.stringify(dataPayload));
        formData.append('config', JSON.stringify(configPayload));
        formData.append('tagIds', tagIds.join(','));
        if (isDynamic) formData.append('isDynamic', 'on');

        startTransition(async () => {
            const result = await createQrCode(null, formData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'QR Code saved successfully.' });
                // Reset form optionally or just keep it for further edits
            }
        });
    };

    const tagOptions = (user.tags || []).map(tag => ({
        value: tag._id,
        label: tag.name,
        color: tag.color,
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Configuration */}
            <div className="lg:col-span-7 space-y-6">
                <Card className="border-0 shadow-lg ring-1 ring-slate-900/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 text-purple-600" />
                            Builder Configuration
                        </CardTitle>
                        <CardDescription>Customize the content and look of your QR code.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* 1. Basic Info */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label>QR Code Name <span className="text-red-500">*</span></Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Campaign 2024" />
                                </div>
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label>Tags</Label>
                                    <MultiSelectCombobox
                                        options={tagOptions}
                                        selected={tagIds}
                                        onSelectionChange={setTagIds}
                                        placeholder="Add tags..."
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-slate-50">
                                <Switch id="dynamic-mode" checked={isDynamic} onCheckedChange={setIsDynamic} disabled={dataType !== 'url'} />
                                <Label htmlFor="dynamic-mode" className="flex-1 cursor-pointer">
                                    <span className="font-semibold block">Dynamic QR Code</span>
                                    <span className="text-xs text-muted-foreground font-normal">Track scans and update URL later without reprinting. (URL only)</span>
                                </Label>
                            </div>
                        </div>

                        <Separator />

                        {/* 2. Data Type Selector */}
                        <div className="space-y-3">
                            <Label>Content Type</Label>
                            <div className="flex flex-wrap gap-2">
                                {DATA_TYPES.map(type => (
                                    <button
                                        key={type.value}
                                        onClick={() => setDataType(type.value)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                                            dataType === type.value
                                                ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:bg-purple-50"
                                        )}
                                    >
                                        <type.icon className="h-4 w-4" />
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Dynamic Inputs */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                            {dataType === 'url' && (
                                <div className="space-y-2">
                                    <Label>Website URL</Label>
                                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourwebsite.com" />
                                </div>
                            )}
                            {dataType === 'text' && (
                                <div className="space-y-2">
                                    <Label>Plain Text</Label>
                                    <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter your text here..." />
                                </div>
                            )}
                            {dataType === 'email' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.com" /></div>
                                    <div className="space-y-2"><Label>Subject</Label><Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Inquiry" /></div>
                                    <div className="space-y-2"><Label>Body</Label><Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Hello..." /></div>
                                </div>
                            )}
                            {dataType === 'phone' && (
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
                                </div>
                            )}
                            {dataType === 'sms' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={sms} onChange={e => setSms(e.target.value)} placeholder="+1 234 567 8900" /></div>
                                    <div className="space-y-2"><Label>Message</Label><Textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} placeholder="I'm interested in..." /></div>
                                </div>
                            )}
                            {dataType === 'wifi' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Network Name (SSID)</Label><Input value={wifiSsid} onChange={e => setWifiSsid(e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Password</Label><Input value={wifiPassword} onChange={e => setWifiPassword(e.target.value)} /></div>
                                    <div className="flex gap-4">
                                        <div className="space-y-2 flex-1">
                                            <Label>Encryption</Label>
                                            <Select value={wifiEncryption} onValueChange={setWifiEncryption}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="WPA">WPA/WPA2</SelectItem>
                                                    <SelectItem value="WEP">WEP</SelectItem>
                                                    <SelectItem value="nopass">None</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 4. Visual Customization */}
                        <div className="space-y-4">
                            <Label className="text-base">Design Customization</Label>

                            <Tabs defaultValue="colors" className="w-full">
                                <TabsList className="w-full justify-start">
                                    <TabsTrigger value="colors">Colors</TabsTrigger>
                                    <TabsTrigger value="branding">Logo & Branding</TabsTrigger>
                                </TabsList>
                                <TabsContent value="colors" className="space-y-4 mt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Foreground Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="w-10 h-10 rounded border cursor-pointer ring-offset-2 hover:ring-2 ring-slate-400" style={{ backgroundColor: dotColor }} />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-3"><SketchPicker color={dotColor} onChange={c => setDotColor(c.hex)} disableAlpha /></PopoverContent>
                                                </Popover>
                                                <Input value={dotColor} onChange={e => setDotColor(e.target.value)} className="w-[120px] font-mono" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Background Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="w-10 h-10 rounded border cursor-pointer ring-offset-2 hover:ring-2 ring-slate-400" style={{ backgroundColor: bgColor }} />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-3"><SketchPicker color={bgColor} onChange={c => setBgColor(c.hex)} disableAlpha /></PopoverContent>
                                                </Popover>
                                                <Input value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-[120px] font-mono" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-w-xs">
                                        <Label>Error Correction Level</Label>
                                        <Select value={eccLevel} onValueChange={setEccLevel}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="L">Low (7%) - Best for clean look</SelectItem>
                                                <SelectItem value="M">Medium (15%)</SelectItem>
                                                <SelectItem value="Q">Quartile (25%)</SelectItem>
                                                <SelectItem value="H">High (30%) - Best if adding logo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Higher correction allowed more damage/logo obstruction.</p>
                                    </div>
                                </TabsContent>
                                <TabsContent value="branding" className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label>Upload Logo (Center Image)</Label>
                                        <div className="flex items-center gap-4">
                                            {logoDataUri ? (
                                                <div className="relative group w-20 h-20 border rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                                                    <img src={logoDataUri} className="max-w-full max-h-full object-contain" />
                                                    <button onClick={() => setLogoDataUri(undefined)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                                                    No Logo
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <Input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} />
                                                <p className="text-xs text-muted-foreground mt-1">Recommended: Square PNG with transparent background. Max 200KB.</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: Preview */}
            <div className="lg:col-span-5 sticky top-6 space-y-6">
                <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 pb-4">
                        <CardTitle className="text-center">Live Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-8 min-h-[350px] bg-slate-100/50 relative">
                        {/* Mobile Phone Frame Effect */}
                        <div className="relative bg-white p-6 rounded-[2rem] shadow-xl border-4 border-slate-900 ring-4 ring-slate-100" ref={qrWrapperRef}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-b-xl z-10" />
                            <QrCodeRenderer
                                value={qrValue}
                                size={220} // Fixed preview size
                                fgColor={dotColor}
                                bgColor={bgColor}
                                level={eccLevel}
                                logoDataUri={logoDataUri}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground mt-6 text-center max-w-[250px] truncate">
                            {qrValue || "Enter data to generate"}
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 pt-6 bg-white border-t">
                        <Button
                            className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 transition-all hover:scale-[1.02]"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Save to Dashboard
                        </Button>
                        <div className="grid grid-cols-2 w-full gap-3">
                            <Button variant="outline" onClick={() => handleDownload('png')}>
                                <Download className="mr-2 h-4 w-4" /> PNG
                            </Button>
                            <Button variant="outline" onClick={() => handleDownload('svg')}>
                                <Download className="mr-2 h-4 w-4" /> SVG
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                {/* Tips Card */}
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="pt-6">
                        <div className="flex gap-3">
                            <div className="mt-1 bg-blue-100 p-2 rounded-full h-fit"><RefreshCw className="h-4 w-4 text-blue-600" /></div>
                            <div>
                                <h4 className="font-semibold text-blue-900">Pro Tip</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    Use 'High' error correction if you plan to add a logo or print this on physical materials where it might get damaged.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
