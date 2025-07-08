
'use client';

import { useState, useMemo, useActionState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Download, QrCode, Link, Type, Mail, Phone, MessageSquare, Wifi, Save, LoaderCircle, Check, ChevronsUpDown, Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { BulkCreateQrDialog } from './bulk-qr-create-dialog';
import { createQrCode } from '@/app/actions/qr-code.actions';
import type { User, Tag } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';

type QrDataType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

const initialState = { message: null, error: null };

function TagsSelector({ userTags, onSelectionChange }: { userTags: Tag[], onSelectionChange: (tagIds: string[]) => void }) {
    const [open, setOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    const handleSelect = (tagId: string) => {
        const newSelected = selectedTags.includes(tagId)
            ? selectedTags.filter(id => id !== tagId)
            : [...selectedTags, tagId];
        setSelectedTags(newSelected);
        onSelectionChange(newSelected);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">
                        {selectedTags.length > 0
                            ? selectedTags.map(id => userTags.find(t => t._id === id)?.name).filter(Boolean).join(', ')
                            : "Select tags..."
                        }
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                        <CommandEmpty>No tags found. Manage tags in settings.</CommandEmpty>
                        <CommandGroup>
                             {userTags.map((tag) => (
                                <CommandItem
                                    key={tag._id}
                                    value={tag.name}
                                    onSelect={() => handleSelect(tag._id)}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", selectedTags.includes(tag._id) ? "opacity-100" : "opacity-0")} />
                                    <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                                    <span>{tag.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save QR Code
        </Button>
    )
}


export function QrCodeGenerator({ user }: { user: Omit<User, 'password'> & { _id: string, tags?: Tag[] } }) {
    const [activeTab, setActiveTab] = useState<QrDataType>('url');
    const [isDynamic, setIsDynamic] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        url: 'https://sabnode.com', text: 'Hello, World!', email: '', emailSubject: '',
        emailBody: '', phone: '', sms: '', smsMessage: '', wifiSsid: '',
        wifiPassword: '', wifiEncryption: 'WPA',
    });

    const [qrConfig, setQrConfig] = useState({
        color: '000000', bgColor: 'FFFFFF', eccLevel: 'L', size: 250,
    });

    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [state, formAction] = useActionState(createQrCode, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const qrCodeRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            setSelectedTagIds([]);
            setLogoFile(null);
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: "destructive" });
        }
    }, [state, toast]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSelectChange = (name: string, value: string) => {
         setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQrConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleColorChange = (name: 'color' | 'bgColor', value: string) => {
        setQrConfig(prev => ({...prev, [name]: value.substring(1)}));
    }

    const qrDataString = useMemo(() => {
        switch (activeTab) {
            case 'url': return formData.url;
            case 'text': return formData.text;
            case 'email': return `mailto:${formData.email}?subject=${encodeURIComponent(formData.emailSubject)}&body=${encodeURIComponent(formData.emailBody)}`;
            case 'phone': return `tel:${formData.phone}`;
            case 'sms': return `smsto:${formData.sms}:${encodeURIComponent(formData.smsMessage)}`;
            case 'wifi': return `WIFI:T:${formData.wifiEncryption};S:${formData.wifiSsid};P:${formData.wifiPassword};;`;
            default: return '';
        }
    }, [activeTab, formData]);

    const handleDownload = () => {
        const svg = qrCodeRef.current?.querySelector('svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const scale = 3;
            const svgSize = svg.getBoundingClientRect();
            canvas.width = svgSize.width * scale;
            canvas.height = svgSize.height * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.fillStyle = `#${qrConfig.bgColor}`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = `qrcode.png`;
                downloadLink.href = pngFile;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };
            img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
        }
    };

    const renderInputFields = () => {
        switch (activeTab) {
            case 'url': return <div className="space-y-2"><Label htmlFor="url">URL</Label><Input id="url" name="url" value={formData.url} onChange={handleFormChange} placeholder="https://example.com" /></div>;
            case 'text': return <div className="space-y-2"><Label htmlFor="text">Text</Label><Textarea id="text" name="text" value={formData.text} onChange={handleFormChange} placeholder="Enter any text" /></div>;
            case 'email': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleFormChange} placeholder="recipient@example.com" pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Please enter a valid email address." /></div><div className="space-y-2"><Label htmlFor="emailSubject">Subject</Label><Input id="emailSubject" name="emailSubject" value={formData.emailSubject} onChange={handleFormChange} placeholder="Email Subject" /></div><div className="space-y-2"><Label htmlFor="emailBody">Body</Label><Textarea id="emailBody" name="emailBody" value={formData.emailBody} onChange={handleFormChange} placeholder="Email Body" /></div></div>;
            case 'phone': return <div className="space-y-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleFormChange} placeholder="+15551234567" /></div>;
            case 'sms': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="sms">Phone Number</Label><Input id="sms" name="sms" type="tel" value={formData.sms} onChange={handleFormChange} placeholder="+15551234567" /></div><div className="space-y-2"><Label htmlFor="smsMessage">Message</Label><Textarea id="smsMessage" name="smsMessage" value={formData.smsMessage} onChange={handleFormChange} placeholder="Your SMS message" /></div></div>;
            case 'wifi': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="wifiSsid">Network Name (SSID)</Label><Input id="wifiSsid" name="wifiSsid" value={formData.wifiSsid} onChange={handleFormChange} placeholder="My Home WiFi" /></div><div className="space-y-2"><Label htmlFor="wifiPassword">Password</Label><Input id="wifiPassword" name="wifiPassword" type="password" value={formData.wifiPassword} onChange={handleFormChange} /></div><div className="space-y-2"><Label htmlFor="wifiEncryption">Encryption</Label><Select name="wifiEncryption" value={formData.wifiEncryption} onValueChange={(val) => handleSelectChange('wifiEncryption', val)}><SelectTrigger id="wifiEncryption"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">None</SelectItem></SelectContent></Select></div></div>;
            default: return null;
        }
    }

    return (
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="dataType" value={activeTab} />
            <input type="hidden" name="data" value={JSON.stringify(formData)} />
            <input type="hidden" name="config" value={JSON.stringify(qrConfig)} />
            <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
            <input type="hidden" name="isDynamic" value={isDynamic ? 'on' : 'off'} />
            
            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Generate a QR Code</CardTitle>
                    <CardDescription>Select a content type and enter your data to create a scannable QR code.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4">
                            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as QrDataType)} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                                    <TabsTrigger value="url"><Link className="h-5 w-5 mx-auto"/>URL</TabsTrigger>
                                    <TabsTrigger value="text"><Type className="h-5 w-5 mx-auto"/>Text</TabsTrigger>
                                    <TabsTrigger value="email"><Mail className="h-5 w-5 mx-auto"/>Email</TabsTrigger>
                                    <TabsTrigger value="phone"><Phone className="h-5 w-5 mx-auto"/>Phone</TabsTrigger>
                                    <TabsTrigger value="sms"><MessageSquare className="h-5 w-5 mx-auto"/>SMS</TabsTrigger>
                                    <TabsTrigger value="wifi"><Wifi className="h-5 w-5 mx-auto"/>Wi-Fi</TabsTrigger>
                                </TabsList>
                                <TabsContent value={activeTab} className="mt-4">{renderInputFields()}</TabsContent>
                            </Tabs>
                            <Separator />
                            <div className="space-y-4">
                                <h3 className="font-medium text-lg">Save & Customize</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" placeholder="e.g., My Website QR Code" required />
                                </div>
                                {activeTab === 'url' && (
                                    <div className="flex items-center space-x-2">
                                        <Switch id="isDynamic" name="isDynamic" checked={isDynamic} onCheckedChange={setIsDynamic} />
                                        <Label htmlFor="isDynamic">Dynamic QR Code (Trackable)</Label>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Tags (Optional)</Label>
                                    <TagsSelector userTags={user?.tags || []} onSelectionChange={setSelectedTagIds} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label htmlFor="color" className="text-sm">Dot Color</Label><Input id="color" type="color" value={`#${qrConfig.color}`} onChange={(e) => handleColorChange('color', e.target.value)} /></div>
                                    <div className="space-y-1"><Label htmlFor="bgColor" className="text-sm">Background Color</Label><Input id="bgColor" type="color" value={`#${qrConfig.bgColor}`} onChange={(e) => handleColorChange('bgColor', e.target.value)} /></div>
                                    <div className="space-y-1"><Label htmlFor="size" className="text-sm">Size (px)</Label><Input id="size" name="size" type="number" min="50" max="1000" value={qrConfig.size} onChange={handleConfigChange} /></div>
                                    <div className="space-y-1"><Label htmlFor="eccLevel" className="text-sm">Error Correction</Label><Select name="eccLevel" value={qrConfig.eccLevel} onValueChange={(val) => setQrConfig(p => ({...p, eccLevel: val}))}><SelectTrigger id="eccLevel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Low (L)</SelectItem><SelectItem value="M">Medium (M)</SelectItem><SelectItem value="Q">Quartile (Q)</SelectItem><SelectItem value="H">High (H)</SelectItem></SelectContent></Select></div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="logoFile">Logo (Optional)</Label>
                                    <Input id="logoFile" name="logoFile" type="file" accept="image/png,image/jpeg" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div ref={qrCodeRef} className="p-4 bg-white rounded-lg aspect-square w-full max-w-xs mx-auto flex items-center justify-center">
                                {qrDataString.trim() ? (
                                    <QRCode
                                        value={qrDataString}
                                        size={256}
                                        fgColor={`#${qrConfig.color}`}
                                        bgColor={`#${qrConfig.bgColor}`}
                                        level={qrConfig.eccLevel as any}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-muted-foreground text-center gap-2 h-full">
                                        <QrCode className="h-16 w-16" />
                                        <p>Enter data to generate a QR code</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 w-full max-w-xs">
                                <Button onClick={handleDownload} disabled={!qrDataString.trim()} className="w-full" type="button">
                                    <Download className="mr-2 h-4 w-4" /> Download PNG
                                </Button>
                                <BulkCreateQrDialog />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
