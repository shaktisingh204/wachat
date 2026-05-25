import {
  MessageSquare,
  ShoppingBag,
  Shield,
  Clock,
  LayoutGrid,
  Hash,
  Type,
  Image as ImageIcon,
  Video,
  FileText,
  MapPin,
  ExternalLink,
  Phone,
  Copy,
} from 'lucide-react';

export const LANGUAGES = [
  { code: 'en_US', name: 'English (US)' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt_BR', name: 'Portuguese (BR)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh_CN', name: 'Chinese (Simplified)' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fil', name: 'Filipino' },
  { code: 'sw', name: 'Swahili' },
];

export const CATEGORIES = [
  { id: 'MARKETING', name: 'Marketing', desc: 'Promotions, offers, updates' },
  { id: 'UTILITY', name: 'Utility', desc: 'Order updates, confirmations' },
  {
    id: 'AUTHENTICATION',
    name: 'Authentication',
    desc: 'OTP, verification codes',
  },
];

export const TEMPLATE_TYPES = [
  {
    id: 'STANDARD',
    name: 'Standard',
    icon: MessageSquare,
    desc: 'Text, media, buttons',
  },
  {
    id: 'CAROUSEL',
    name: 'Carousel',
    icon: LayoutGrid,
    desc: 'Scrollable media cards',
  },
  {
    id: 'CATALOG',
    name: 'Catalog',
    icon: ShoppingBag,
    desc: 'Interactive product list',
  },
  { id: 'AUTH', name: 'Authentication', icon: Shield, desc: 'OTP verification' },
  {
    id: 'LTO',
    name: 'Limited Time Offer',
    icon: Clock,
    desc: 'Expiring promotions',
  },
];

export const HEADER_FORMATS = [
  { id: 'NONE', name: 'None', icon: Hash },
  { id: 'TEXT', name: 'Text', icon: Type },
  { id: 'IMAGE', name: 'Image', icon: ImageIcon },
  { id: 'VIDEO', name: 'Video', icon: Video },
  { id: 'DOCUMENT', name: 'Document', icon: FileText },
  { id: 'LOCATION', name: 'Location', icon: MapPin },
];

export const BUTTON_TYPES = [
  { id: 'QUICK_REPLY', name: 'Quick Reply', icon: MessageSquare },
  { id: 'URL', name: 'URL', icon: ExternalLink },
  { id: 'PHONE_NUMBER', name: 'Call', icon: Phone },
  { id: 'COPY_CODE', name: 'Copy Code', icon: Copy },
];

export type ButtonData = {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};
