'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Popover, PopoverContent, PopoverTrigger, Separator } from '@/components/sabcrm/20ui';
import {
  useState,
  useRef,
  useEffect,
  useTransition } from 'react';
import {
  LoaderCircle,
  QrCode,
  Link as LinkIcon,
  Type,
  Mail,
  Phone,
  Wifi,
  MessageSquare,
  Download,
  Save,
  RefreshCw,
  Wand2,
  Upload,
  User,
  Calendar,
  MapPin,
  Smartphone,
  Share2,
  ChevronDown,
  ChevronUp,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';
import { useToast } from '@/hooks/use-toast';
import { createQrCode } from '@/app/actions/qr-code.actions';
import { QrCodeRenderer } from './qr-code-renderer';
import { SketchPicker } from 'react-color';
import type { User as UserType, Tag } from '@/lib/definitions';
import { MultiSelectCombobox } from './multi-select-combobox';
import { cn } from '@/lib/utils';
import {
  buildCalendarEvent,
  buildVCard,
  downloadQrCode,
  filterPhoneLikeInput,
  normalizeQrWebsiteUrl,
  QR_FIELD_LIMITS,
} from '@/lib/qr-utils';

type DownloadFormat = 'png' | 'svg' | 'webp' | 'pdf';

type DotStyle = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded';

interface GradientConfig {
  colorStart: string;
  colorEnd: string;
  rotation: number;
}

interface FrameConfig {
  template: 'simple' | 'rounded' | 'banner';
  text: string;
  textColor: string;
  bgColor: string;
}

const DOT_STYLES: Array<{ value: DotStyle; label: string }> = [
  { value: 'square', label: 'Square' },
  { value: 'dots', label: 'Dots' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
];

const FRAME_TEMPLATES: Array<{ value: 'none' | 'simple' | 'rounded' | 'banner'; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'simple', label: 'Simple' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'banner', label: 'Banner' },
];

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourprofile' },
  { value: 'twitter', label: 'Twitter/X', placeholder: 'https://x.com/yourhandle' },
  { value: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
];

const DATA_TYPES = [
    { value: 'url', label: 'Website', icon: LinkIcon },
    { value: 'text', label: 'Plain Text', icon: Type },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'wifi', label: 'WiFi', icon: Wifi },
    { value: 'contact', label: 'Contact', icon: User },
    { value: 'calendar', label: 'Calendar', icon: Calendar },
    { value: 'location', label: 'Location', icon: MapPin },
    { value: 'app', label: 'App Download', icon: Smartphone },
    { value: 'social', label: 'Social', icon: Share2 },
];

export function QrCodeGenerator({ user }: { user: Omit<UserType, 'password'> & { _id: string, tags?: Tag[] } }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [dataType, setDataType] = useState('url');
    const [name, setName] = useState('');
    const [tagIds, setTagIds] = useState<string[]>([]);

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

    const [vcardFirstName, setVcardFirstName] = useState('');
    const [vcardLastName, setVcardLastName] = useState('');
    const [vcardOrg, setVcardOrg] = useState('');
    const [vcardPhone, setVcardPhone] = useState('');
    const [vcardEmail, setVcardEmail] = useState('');
    const [vcardUrl, setVcardUrl] = useState('');
    const [vcardAddress, setVcardAddress] = useState('');

    const [calTitle, setCalTitle] = useState('');
    const [calStart, setCalStart] = useState('');
    const [calEnd, setCalEnd] = useState('');
    const [calLocation, setCalLocation] = useState('');
    const [calDescription, setCalDescription] = useState('');

    const [locationMode, setLocationMode] = useState<'address' | 'latlng'>('address');
    const [geoAddress, setGeoAddress] = useState('');
    const [geoLat, setGeoLat] = useState('');
    const [geoLng, setGeoLng] = useState('');

    const [appName, setAppName] = useState('');
    const [appIosUrl, setAppIosUrl] = useState('');
    const [appAndroidUrl, setAppAndroidUrl] = useState('');

    const [socialPlatform, setSocialPlatform] = useState('instagram');
    const [socialUrl, setSocialUrl] = useState('');

    const [dotColor, setDotColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [eccLevel, setEccLevel] = useState('L');
    const [logoDataUri, setLogoDataUri] = useState<string | undefined>(undefined);
    const [isDynamic, setIsDynamic] = useState(true);

    const [dotStyle, setDotStyle] = useState<DotStyle>('square');
    const [useGradient, setUseGradient] = useState(false);
    const [gradient, setGradient] = useState<GradientConfig>({ colorStart: '#000000', colorEnd: '#6600ff', rotation: 0 });

    const [frameTemplate, setFrameTemplate] = useState<'none' | 'simple' | 'rounded' | 'banner'>('none');
    const [frame, setFrame] = useState<FrameConfig>({ template: 'simple', text: 'Scan Me', textColor: '#000000', bgColor: '#ffffff' });

    const [styleOpen, setStyleOpen] = useState(false);
    const [frameOpen, setFrameOpen] = useState(false);
    const [designSection, setDesignSection] = useState<'colors' | 'branding'>('colors');
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('png');
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

    const [brandKits, setBrandKits] = useState<{ id: string; name: string; color?: string; bgColor?: string; logoDataUri?: string }[]>([]);
    const [showBrandKits, setShowBrandKits] = useState(false);

    const qrWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('qr-brand-kits');
            if (stored) setBrandKits(JSON.parse(stored));
        } catch {}
    }, []);

    const getQrValue = () => {
        switch (dataType) {
            case 'url': return normalizeQrWebsiteUrl(url) || 'https://example.com';
            case 'text': return text || 'Example Text';
            case 'email': return `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            case 'phone': return `tel:${filterPhoneLikeInput(phone)}`;
            case 'sms': return `smsto:${filterPhoneLikeInput(sms)}:${encodeURIComponent(smsMessage)}`;
            case 'wifi': return `WIFI:T:${wifiEncryption};S:${wifiSsid};P:${wifiPassword};H:${wifiHidden};;`;
            case 'contact': return buildVCard({
                firstName: vcardFirstName,
                lastName: vcardLastName,
                org: vcardOrg,
                phone: filterPhoneLikeInput(vcardPhone, QR_FIELD_LIMITS.vcardPhone),
                email: vcardEmail,
                url: normalizeQrWebsiteUrl(vcardUrl),
                address: vcardAddress,
            }) || 'BEGIN:VCARD\nVERSION:3.0\nEND:VCARD';
            case 'calendar': return calTitle && calStart && calEnd
                ? buildCalendarEvent({ title: calTitle, startDate: new Date(calStart).toISOString(), endDate: new Date(calEnd).toISOString(), location: calLocation, description: calDescription })
                : 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
            case 'location':
                if (locationMode === 'latlng' && geoLat && geoLng) return `geo:${geoLat},${geoLng}`;
                return geoAddress ? `https://maps.google.com/?q=${encodeURIComponent(geoAddress)}` : 'https://maps.google.com';
            case 'app': return normalizeQrWebsiteUrl(appIosUrl) || 'https://apps.apple.com';
            case 'social': return normalizeQrWebsiteUrl(socialUrl) || 'https://example.com';
            default: return '';
        }
    };

    const qrValue = getQrValue();

    const handleDownload = async (fmt: DownloadFormat) => {
        const svg = qrWrapperRef.current?.querySelector('svg');
        if (!svg) return;
        await downloadQrCode(svg, {
            filename: `qrcode-${name || 'untitled'}`,
            format: fmt,
            bgColor,
            logoDataUri,
            size: 256,
        });
    };

    const handleSave = async () => {
        if (!name) {
            toast({ title: 'Name required', description: 'Please give your QR code a name.', variant: 'destructive' });
            return;
        }

        const dataPayload = {
            url: normalizeQrWebsiteUrl(url),
            text,
            email,
            emailSubject,
            emailBody,
            phone: filterPhoneLikeInput(phone),
            sms: filterPhoneLikeInput(sms),
            smsMessage,
            wifiSsid, wifiPassword, wifiEncryption, wifiHidden,
            vcardFirstName, vcardLastName, vcardOrg, vcardPhone, vcardEmail, vcardUrl, vcardAddress,
            calTitle, calStart, calEnd, calLocation, calDescription,
            locationMode, geoAddress, geoLat, geoLng,
            appName, appIosUrl, appAndroidUrl,
            socialPlatform, socialUrl,
        };

        const configPayload = {
            color: useGradient ? gradient.colorStart : dotColor,
            bgColor,
            eccLevel,
            logoDataUri,
            dotType: dotStyle,
            gradient: useGradient ? { type: 'linear', ...gradient } : undefined,
        };

        const formData = new FormData();
        formData.append('name', name);
        formData.append('dataType', dataType);
        formData.append('data', JSON.stringify(dataPayload));
        formData.append('config', JSON.stringify(configPayload));
        formData.append('style', JSON.stringify({ dotType: dotStyle, gradient: useGradient ? { type: 'linear', ...gradient } : undefined }));
        if (frameTemplate !== 'none') {
            formData.append('frame', JSON.stringify({ ...frame, template: frameTemplate }));
        }
        formData.append('tagIds', tagIds.join(','));
        if (isDynamic) formData.append('isDynamic', 'on');

        startTransition(async () => {
            const result = await createQrCode(null, formData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'QR Code saved successfully.' });
            }
        });
    };

    const tagOptions = (user.tags || []).map(tag => ({
        value: tag._id,
        label: tag.name,
        color: tag.color,
    }));

    const currentSocialPlatform = SOCIAL_PLATFORMS.find(p => p.value === socialPlatform);

    const effectiveDotColor = useGradient ? gradient.colorStart : dotColor;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
                <Card className="border-0 shadow-lg ring-1 ring-[var(--st-border)]/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 text-[var(--st-text)]" />
                            Builder Configuration
                        </CardTitle>
                        <CardDescription>Customize the content and look of your QR code.</CardDescription>
                    </CardHeader>
                    <CardBody className="space-y-6">

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label>QR Code Name <span className="text-[var(--st-text)]">*</span></Label>
                                    <Input value={name} onChange={e => setName(e.target.value.slice(0, QR_FIELD_LIMITS.name))} maxLength={QR_FIELD_LIMITS.name} placeholder="e.g. Summer Campaign 2024" />
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

                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-[var(--st-bg-muted)]">
                                <Switch id="dynamic-mode" checked={isDynamic} onCheckedChange={setIsDynamic} disabled={dataType !== 'url'} />
                                <Label htmlFor="dynamic-mode" className="flex-1 cursor-pointer">
                                    <span className="font-semibold block">Dynamic QR Code</span>
                                    <span className="text-xs text-[var(--st-text-secondary)] font-normal">Track scans and update URL later without reprinting. (URL only)</span>
                                </Label>
                            </div>
                        </div>

                        <Separator />

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
                                                ? "bg-[var(--st-text)] text-white border-[var(--st-border)] shadow-md"
                                                : "bg-white text-[var(--st-text)] border-[var(--st-border)] hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]"
                                        )}
                                    >
                                        <type.icon className="h-4 w-4" />
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)]">
                            {dataType === 'url' && (
                                <div className="space-y-2">
                                    <Label>Website URL</Label>
                                    <Input value={url} onChange={e => setUrl(e.target.value.slice(0, QR_FIELD_LIMITS.url))} maxLength={QR_FIELD_LIMITS.url} placeholder="https://yourwebsite.com" />
                                </div>
                            )}
                            {dataType === 'text' && (
                                <div className="space-y-2">
                                    <Label>Plain Text</Label>
                                    <Textarea value={text} onChange={e => setText(e.target.value.slice(0, QR_FIELD_LIMITS.text))} maxLength={QR_FIELD_LIMITS.text} placeholder="Enter your text here..." />
                                </div>
                            )}
                            {dataType === 'email' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value.slice(0, QR_FIELD_LIMITS.email))} maxLength={QR_FIELD_LIMITS.email} placeholder="contact@example.com" /></div>
                                    <div className="space-y-2"><Label>Subject</Label><Input value={emailSubject} onChange={e => setEmailSubject(e.target.value.slice(0, QR_FIELD_LIMITS.emailSubject))} maxLength={QR_FIELD_LIMITS.emailSubject} placeholder="Inquiry" /></div>
                                    <div className="space-y-2"><Label>Body</Label><Textarea value={emailBody} onChange={e => setEmailBody(e.target.value.slice(0, QR_FIELD_LIMITS.emailBody))} maxLength={QR_FIELD_LIMITS.emailBody} placeholder="Hello..." /></div>
                                </div>
                            )}
                            {dataType === 'phone' && (
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(filterPhoneLikeInput(e.target.value))} maxLength={QR_FIELD_LIMITS.phone} placeholder="+1 234 567 8900" />
                                </div>
                            )}
                            {dataType === 'sms' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Phone Number</Label><Input type="tel" inputMode="tel" value={sms} onChange={e => setSms(filterPhoneLikeInput(e.target.value))} maxLength={QR_FIELD_LIMITS.phone} placeholder="+1 234 567 8900" /></div>
                                    <div className="space-y-2"><Label>Message</Label><Textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value.slice(0, QR_FIELD_LIMITS.smsMessage))} maxLength={QR_FIELD_LIMITS.smsMessage} placeholder="I'm interested in..." /></div>
                                </div>
                            )}
                            {dataType === 'wifi' && (
                                <div className="space-y-3">
                                    <div className="space-y-2"><Label>Network Name (SSID)</Label><Input value={wifiSsid} onChange={e => setWifiSsid(e.target.value.slice(0, QR_FIELD_LIMITS.wifiSsid))} maxLength={QR_FIELD_LIMITS.wifiSsid} /></div>
                                    <div className="space-y-2"><Label>Password</Label><Input value={wifiPassword} onChange={e => setWifiPassword(e.target.value.slice(0, QR_FIELD_LIMITS.wifiPassword))} maxLength={QR_FIELD_LIMITS.wifiPassword} /></div>
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
                            {dataType === 'contact' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>First Name</Label>
                                            <Input value={vcardFirstName} onChange={e => setVcardFirstName(e.target.value.slice(0, QR_FIELD_LIMITS.vcardName))} placeholder="Jane" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Last Name</Label>
                                            <Input value={vcardLastName} onChange={e => setVcardLastName(e.target.value.slice(0, QR_FIELD_LIMITS.vcardName))} placeholder="Doe" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Organization</Label>
                                        <Input value={vcardOrg} onChange={e => setVcardOrg(e.target.value.slice(0, QR_FIELD_LIMITS.vcardOrg))} placeholder="Acme Corp" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input type="tel" inputMode="tel" value={vcardPhone} onChange={e => setVcardPhone(filterPhoneLikeInput(e.target.value, QR_FIELD_LIMITS.vcardPhone))} placeholder="+1 234 567 8900" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input type="email" value={vcardEmail} onChange={e => setVcardEmail(e.target.value.slice(0, QR_FIELD_LIMITS.vcardEmail))} placeholder="jane@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Website</Label>
                                        <Input value={vcardUrl} onChange={e => setVcardUrl(e.target.value.slice(0, QR_FIELD_LIMITS.vcardUrl))} placeholder="https://example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Address</Label>
                                        <Textarea value={vcardAddress} onChange={e => setVcardAddress(e.target.value.slice(0, 300))} placeholder="123 Main St, City, Country" />
                                    </div>
                                </div>
                            )}
                            {dataType === 'calendar' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>Event Title</Label>
                                        <Input value={calTitle} onChange={e => setCalTitle(e.target.value.slice(0, QR_FIELD_LIMITS.calendarTitle))} placeholder="Team Meeting" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Start Date & Time</Label>
                                            <input
                                                type="datetime-local"
                                                value={calStart}
                                                onChange={e => setCalStart(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End Date & Time</Label>
                                            <input
                                                type="datetime-local"
                                                value={calEnd}
                                                onChange={e => setCalEnd(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input value={calLocation} onChange={e => setCalLocation(e.target.value.slice(0, QR_FIELD_LIMITS.calendarLocation))} placeholder="Conference Room A" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea value={calDescription} onChange={e => setCalDescription(e.target.value.slice(0, 500))} placeholder="Agenda details..." />
                                    </div>
                                </div>
                            )}
                            {dataType === 'location' && (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setLocationMode('address')}
                                            className={cn(
                                                "flex-1 py-2 rounded-md text-sm font-medium border transition-all",
                                                locationMode === 'address'
                                                    ? "bg-[var(--st-text)] text-white border-[var(--st-border)]"
                                                    : "bg-white text-[var(--st-text)] border-[var(--st-border)] hover:border-[var(--st-border)]"
                                            )}
                                        >
                                            Address
                                        </button>
                                        <button
                                            onClick={() => setLocationMode('latlng')}
                                            className={cn(
                                                "flex-1 py-2 rounded-md text-sm font-medium border transition-all",
                                                locationMode === 'latlng'
                                                    ? "bg-[var(--st-text)] text-white border-[var(--st-border)]"
                                                    : "bg-white text-[var(--st-text)] border-[var(--st-border)] hover:border-[var(--st-border)]"
                                            )}
                                        >
                                            Lat / Lng
                                        </button>
                                    </div>
                                    {locationMode === 'address' ? (
                                        <div className="space-y-2">
                                            <Label>Address</Label>
                                            <Input value={geoAddress} onChange={e => setGeoAddress(e.target.value.slice(0, QR_FIELD_LIMITS.geoAddress))} placeholder="1600 Amphitheatre Pkwy, Mountain View, CA" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Latitude</Label>
                                                <Input type="number" value={geoLat} onChange={e => setGeoLat(e.target.value)} placeholder="37.422" step="any" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Longitude</Label>
                                                <Input type="number" value={geoLng} onChange={e => setGeoLng(e.target.value)} placeholder="-122.084" step="any" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {dataType === 'app' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>App Name</Label>
                                        <Input value={appName} onChange={e => setAppName(e.target.value)} placeholder="My Awesome App" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>iOS App Store URL</Label>
                                        <Input value={appIosUrl} onChange={e => setAppIosUrl(e.target.value)} placeholder="https://apps.apple.com/app/..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Android Play Store URL</Label>
                                        <Input value={appAndroidUrl} onChange={e => setAppAndroidUrl(e.target.value)} placeholder="https://play.google.com/store/apps/..." />
                                    </div>
                                    <p className="text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-md px-3 py-2">
                                        The QR encodes the iOS URL. The landing page detects platform to redirect appropriately.
                                    </p>
                                </div>
                            )}
                            {dataType === 'social' && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>Platform</Label>
                                        <Select value={socialPlatform} onValueChange={setSocialPlatform}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {SOCIAL_PLATFORMS.map(p => (
                                                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Profile URL</Label>
                                        <Input
                                            value={socialUrl}
                                            onChange={e => setSocialUrl(e.target.value)}
                                            placeholder={currentSocialPlatform?.placeholder}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <Label className="text-base">Design Customization</Label>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <nav
                                    aria-label="Design customization sections"
                                    className="sm:w-44 flex-shrink-0 flex sm:flex-col gap-1 p-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 sm:self-start"
                                >
                                    {[
                                        { id: 'colors' as const, label: 'Colors', icon: Palette },
                                        { id: 'branding' as const, label: 'Logo & Branding', icon: ImageIcon },
                                    ].map((item) => {
                                        const Icon = item.icon;
                                        const isActive = designSection === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setDesignSection(item.id)}
                                                aria-current={isActive ? 'true' : undefined}
                                                className={cn(
                                                    'flex items-center gap-2 px-3 py-2 text-[12.5px] rounded-md transition-colors text-left flex-1 sm:flex-none',
                                                    isActive
                                                        ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm border border-[var(--st-border)]'
                                                        : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg)] hover:text-[var(--st-text)] border border-transparent',
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </nav>
                                <div className="flex-1 min-w-0">
                                {designSection === 'colors' && (
                                <div className="space-y-4">
                                    {brandKits.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Brand Kit</Label>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => setShowBrandKits((v) => !v)}
                                                >
                                                    {showBrandKits ? 'Hide' : 'Apply Kit'}
                                                </Button>
                                            </div>
                                            {showBrandKits && (
                                                <div className="flex flex-wrap gap-2">
                                                    {brandKits.map((kit) => (
                                                        <button
                                                            key={kit.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (kit.color) setDotColor(kit.color);
                                                                if (kit.bgColor) setBgColor(kit.bgColor);
                                                                if (kit.logoDataUri) setLogoDataUri(kit.logoDataUri);
                                                                setShowBrandKits(false);
                                                            }}
                                                            className="flex items-center gap-1.5 rounded-md border border-[var(--st-border)] bg-[var(--st-text)] px-2 py-1 text-[11.5px] text-[var(--st-text)] hover:bg-[var(--st-text)] transition-colors"
                                                        >
                                                            <span
                                                                className="h-3 w-3 rounded-sm border border-white/10 flex-shrink-0"
                                                                style={{ backgroundColor: kit.color ?? '#000000' }}
                                                            />
                                                            {kit.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {!useGradient && (
                                            <div className="space-y-2">
                                                <Label>Foreground Color</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="w-10 h-10 rounded border cursor-pointer ring-offset-2 hover:ring-2 ring-[var(--st-border)]" style={{ backgroundColor: dotColor }} />
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-3"><SketchPicker color={dotColor} onChange={c => setDotColor(c.hex)} disableAlpha /></PopoverContent>
                                                    </Popover>
                                                    <Input value={dotColor} onChange={e => setDotColor(e.target.value)} className="w-[120px] font-mono" />
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>Background Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="w-10 h-10 rounded border cursor-pointer ring-offset-2 hover:ring-2 ring-[var(--st-border)]" style={{ backgroundColor: bgColor }} />
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
                                        <p className="text-xs text-[var(--st-text-secondary)]">Higher correction allowed more damage/logo obstruction.</p>
                                    </div>
                                </div>
                                )}
                                {designSection === 'branding' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Upload Logo (Center Image)</Label>
                                        <div className="flex items-center gap-4">
                                            {logoDataUri ? (
                                                <div className="relative group w-20 h-20 border rounded-lg overflow-hidden flex items-center justify-center bg-[var(--st-bg-muted)]">
                                                    <img src={logoDataUri} className="max-w-full max-h-full object-contain" alt="Logo preview" />
                                                    <button onClick={() => setLogoDataUri(undefined)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 border-2 border-dashed border-[var(--st-border)] rounded-lg flex items-center justify-center text-[var(--st-text-secondary)]">
                                                    No Logo
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <SabFilePickerButton
                                                    accept="image"
                                                    onPick={({ url }) => setLogoDataUri(url)}
                                                >
                                                    <Upload className="h-4 w-4" /> Choose logo
                                                </SabFilePickerButton>
                                                <p className="text-xs text-[var(--st-text-secondary)] mt-1">Recommended: Square PNG with transparent background.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )}
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setStyleOpen(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--st-bg-muted)] hover:bg-[var(--st-bg-muted)] transition-colors text-sm font-medium"
                            >
                                <span className="flex items-center gap-2"><QrCode className="h-4 w-4 text-[var(--st-text)]" /> Advanced Style</span>
                                {styleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {styleOpen && (
                                <div className="p-4 space-y-5">
                                    <div className="space-y-3">
                                        <Label>Dot Style</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {DOT_STYLES.map(style => (
                                                <button
                                                    key={style.value}
                                                    onClick={() => setDotStyle(style.value)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded border text-xs font-medium transition-all",
                                                        dotStyle === style.value
                                                            ? "bg-[var(--st-text)] text-white border-[var(--st-border)]"
                                                            : "bg-white text-[var(--st-text)] border-[var(--st-border)] hover:border-[var(--st-border)]"
                                                    )}
                                                >
                                                    {style.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label>Use Gradient Color</Label>
                                            <Switch checked={useGradient} onCheckedChange={setUseGradient} />
                                        </div>
                                        {useGradient ? (
                                            <div className="space-y-3 p-3 bg-[var(--st-bg-muted)] rounded-lg">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Start Color</Label>
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="color"
                                                                value={gradient.colorStart}
                                                                onChange={e => setGradient(g => ({ ...g, colorStart: e.target.value }))}
                                                                className="w-10 h-10 rounded border cursor-pointer p-0.5"
                                                            />
                                                            <Input value={gradient.colorStart} onChange={e => setGradient(g => ({ ...g, colorStart: e.target.value }))} className="w-[100px] font-mono text-xs" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">End Color</Label>
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="color"
                                                                value={gradient.colorEnd}
                                                                onChange={e => setGradient(g => ({ ...g, colorEnd: e.target.value }))}
                                                                className="w-10 h-10 rounded border cursor-pointer p-0.5"
                                                            />
                                                            <Input value={gradient.colorEnd} onChange={e => setGradient(g => ({ ...g, colorEnd: e.target.value }))} className="w-[100px] font-mono text-xs" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Rotation: {gradient.rotation}°</Label>
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={360}
                                                        value={gradient.rotation}
                                                        onChange={e => setGradient(g => ({ ...g, rotation: Number(e.target.value) }))}
                                                        className="w-full accent-[var(--st-text)]"
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setFrameOpen(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--st-bg-muted)] hover:bg-[var(--st-bg-muted)] transition-colors text-sm font-medium"
                            >
                                <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[var(--st-text)]" /> QR Frame</span>
                                {frameOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {frameOpen && (
                                <div className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Frame Template</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {FRAME_TEMPLATES.map(t => (
                                                <button
                                                    key={t.value}
                                                    onClick={() => setFrameTemplate(t.value)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded border text-xs font-medium transition-all",
                                                        frameTemplate === t.value
                                                            ? "bg-[var(--st-text)] text-white border-[var(--st-border)]"
                                                            : "bg-white text-[var(--st-text)] border-[var(--st-border)] hover:border-[var(--st-border)]"
                                                    )}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {frameTemplate !== 'none' && (
                                        <div className="space-y-3 p-3 bg-[var(--st-bg-muted)] rounded-lg">
                                            <div className="space-y-2">
                                                <Label>Frame Text</Label>
                                                <Input
                                                    value={frame.text}
                                                    onChange={e => setFrame(f => ({ ...f, text: e.target.value }))}
                                                    placeholder="Scan Me"
                                                    maxLength={50}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Text Color</Label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={frame.textColor}
                                                            onChange={e => setFrame(f => ({ ...f, textColor: e.target.value }))}
                                                            className="w-10 h-10 rounded border cursor-pointer p-0.5"
                                                        />
                                                        <Input value={frame.textColor} onChange={e => setFrame(f => ({ ...f, textColor: e.target.value }))} className="w-[100px] font-mono text-xs" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Frame BG Color</Label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="color"
                                                            value={frame.bgColor}
                                                            onChange={e => setFrame(f => ({ ...f, bgColor: e.target.value }))}
                                                            className="w-10 h-10 rounded border cursor-pointer p-0.5"
                                                        />
                                                        <Input value={frame.bgColor} onChange={e => setFrame(f => ({ ...f, bgColor: e.target.value }))} className="w-[100px] font-mono text-xs" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </CardBody>
                </Card>
            </div>

            <div className="lg:col-span-5 sticky top-6 space-y-6">
                <Card className="border-0 shadow-lg ring-1 ring-[var(--st-border)]/5 overflow-hidden">
                    <CardHeader className="bg-[var(--st-bg-muted)]/50 pb-4">
                        <CardTitle className="text-center">Live Preview</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col items-center justify-center py-8 min-h-[350px] bg-[var(--st-bg-muted)]/50 relative">
                        <div className="relative bg-white p-6 rounded-[2rem] shadow-xl border-4 border-[var(--st-border)] ring-4 ring-[var(--st-border)]" ref={qrWrapperRef}>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-[var(--st-text)] rounded-b-xl z-10" />
                            <QrCodeRenderer
                                value={qrValue}
                                size={220}
                                fgColor={effectiveDotColor}
                                bgColor={bgColor}
                                level={eccLevel}
                                logoDataUri={logoDataUri}
                            />
                        </div>
                        <p className="text-sm text-[var(--st-text-secondary)] mt-6 text-center max-w-[250px] truncate">
                            {qrValue || "Enter data to generate"}
                        </p>
                    </CardBody>
                    <CardFooter className="flex flex-col gap-3 pt-6 bg-white border-t">
                        <Button
                            className="w-full h-12 text-lg bg-gradient-to-r from-[var(--st-text)] to-[var(--st-text)] hover:from-[var(--st-text)] hover:to-[var(--st-text)] shadow-lg shadow-[var(--st-border)] transition-all hover:scale-[1.02]"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Save to Dashboard
                        </Button>
                        <div className="relative w-full">
                            <div className="flex w-full rounded-md overflow-hidden border">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-none border-0 border-r"
                                    onClick={() => handleDownload(downloadFormat)}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download {downloadFormat.toUpperCase()}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-none border-0 px-3"
                                    onClick={() => setDownloadMenuOpen(v => !v)}
                                    aria-label="Choose download format"
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>
                            {downloadMenuOpen && (
                                <div className="absolute bottom-full mb-1 right-0 bg-white border rounded-md shadow-lg z-20 min-w-[120px] overflow-hidden">
                                    {(['png', 'svg', 'webp', 'pdf'] as DownloadFormat[]).map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => { setDownloadFormat(fmt); setDownloadMenuOpen(false); }}
                                            className={cn(
                                                "w-full text-left px-4 py-2 text-sm hover:bg-[var(--st-bg-muted)] transition-colors",
                                                downloadFormat === fmt && "bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium"
                                            )}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardFooter>
                </Card>

                <Card className="bg-[var(--st-bg-muted)] border-[var(--st-border)]">
                    <CardBody className="pt-6">
                        <div className="flex gap-3">
                            <div className="mt-1 bg-[var(--st-bg-muted)] p-2 rounded-full h-fit"><RefreshCw className="h-4 w-4 text-[var(--st-text)]" /></div>
                            <div>
                                <h4 className="font-semibold text-[var(--st-text)]">Pro Tip</h4>
                                <p className="text-sm text-[var(--st-text)] mt-1">
                                    Use 'High' error correction if you plan to add a logo or print this on physical materials where it might get damaged.
                                </p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
