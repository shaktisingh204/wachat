'use client';

import { useState, useEffect, useRef } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { 
  Input, 
  Label, 
  Switch, 
  Card,
  ZoruCardContent,
  Textarea
} from '@/components/zoruui';

function useTextWidth() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  const measureWidth = (text: string, font: string) => {
    if (!canvasRef.current) return 0;
    const context = canvasRef.current.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
  };

  const truncateByPixel = (text: string, font: string, maxWidth: number) => {
    if (!canvasRef.current) return text;
    const context = canvasRef.current.getContext('2d');
    if (!context) return text;
    
    context.font = font;
    if (context.measureText(text).width <= maxWidth) return text;
    
    const ellipsis = '...';
    const ellipsisWidth = context.measureText(ellipsis).width;
    
    let left = 0;
    let right = text.length;
    let result = text;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const substring = text.substring(0, mid);
      const width = context.measureText(substring).width;
      
      if (width + ellipsisWidth <= maxWidth) {
        result = substring;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return result.trim() + ellipsis;
  };

  return { measureWidth, truncateByPixel };
}

export default function SerpPreviewPage() {
  const [title, setTitle] = useState('Example Title - Maximize Your Reach Today');
  const [url, setUrl] = useState('https://www.example.com/best-seo-tools');
  const [description, setDescription] = useState('This is an example of a meta description. It should be concise, informative, and engaging. A good meta description can improve your click-through rate dramatically if properly optimized.');
  
  const [showDate, setShowDate] = useState(false);
  const [dateStr, setDateStr] = useState('Oct 15, 2024');
  const [showStars, setShowStars] = useState(false);
  const [rating, setRating] = useState('4.8');
  const [votes, setVotes] = useState('125');

  const { measureWidth, truncateByPixel } = useTextWidth();
  
  // Truncation calculations
  const [truncatedTitle, setTruncatedTitle] = useState(title);
  const [truncatedUrl, setTruncatedUrl] = useState(url);
  const [hostname, setHostname] = useState('example.com');
  const [truncatedDesc, setTruncatedDesc] = useState(description);
  
  const [titleWidth, setTitleWidth] = useState(0);
  const [descWidth, setDescWidth] = useState(0);

  const MAX_TITLE_WIDTH = 600;
  const MAX_DESC_WIDTH = 960; // Approx 2 lines of description
  const TITLE_FONT = "20px arial, sans-serif";
  const DESC_FONT = "14px arial, sans-serif";

  useEffect(() => {
    setTitleWidth(measureWidth(title, TITLE_FONT));
    setTruncatedTitle(truncateByPixel(title, TITLE_FONT, MAX_TITLE_WIDTH));
    
    let availableDescWidth = MAX_DESC_WIDTH;
    
    if (showDate && dateStr) {
      const datePrefix = `${dateStr} — `;
      const dateWidth = measureWidth(datePrefix, DESC_FONT);
      availableDescWidth -= dateWidth;
    }
    
    setDescWidth(measureWidth(description, DESC_FONT));
    setTruncatedDesc(truncateByPixel(description, DESC_FONT, availableDescWidth));
    
    // Simple URL parsing for breadcrumb look
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      setHostname(u.hostname.replace('www.', ''));
      setTruncatedUrl(`${u.hostname.replace('www.', '')} › ${u.pathname.split('/').filter(Boolean).join(' › ')}`);
    } catch {
      setHostname('example.com');
      setTruncatedUrl(url);
    }
    
  }, [title, url, description, showDate, dateStr, measureWidth, truncateByPixel]);

  return (
    <ToolShell 
      title="SERP Preview & Simulator" 
      description="Preview how your web page will look in Google's Search Engine Results Pages (SERP). We use pixel-width simulation for accurate truncation."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Editor Panel */}
        <Card>
          <ZoruCardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Title Tag</Label>
                  <span className={`text-xs ${titleWidth > MAX_TITLE_WIDTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {Math.round(titleWidth)} / {MAX_TITLE_WIDTH}px
                  </span>
                </div>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
                <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
                  <div 
                    className={`h-full ${titleWidth > MAX_TITLE_WIDTH ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{ width: `${Math.min(100, (titleWidth / MAX_TITLE_WIDTH) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Meta Description</Label>
                  <span className={`text-xs ${descWidth > MAX_DESC_WIDTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {Math.round(descWidth)} / {MAX_DESC_WIDTH}px
                  </span>
                </div>
                <Textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={4} 
                />
                <div className="h-1.5 w-full bg-muted rounded overflow-hidden">
                  <div 
                    className={`h-full ${descWidth > MAX_DESC_WIDTH ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{ width: `${Math.min(100, (descWidth / MAX_DESC_WIDTH) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-4">
              <h3 className="font-semibold text-sm">Rich Snippets</h3>
              
              <div className="flex items-center justify-between">
                <Label>Show Date Snippet</Label>
                <Switch checked={showDate} onCheckedChange={setShowDate} />
              </div>
              {showDate && (
                <Input 
                  value={dateStr} 
                  onChange={e => setDateStr(e.target.value)} 
                  placeholder="e.g. Oct 15, 2024"
                  className="mt-2"
                />
              )}

              <div className="flex items-center justify-between">
                <Label>Show Star Ratings</Label>
                <Switch checked={showStars} onCheckedChange={setShowStars} />
              </div>
              {showStars && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Rating</Label>
                    <Input type="number" step="0.1" value={rating} onChange={e => setRating(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Votes</Label>
                    <Input type="number" value={votes} onChange={e => setVotes(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </ZoruCardContent>
        </Card>

        {/* Preview Panel */}
        <div>
          <Label className="mb-4 block text-lg font-semibold">Google Desktop Preview</Label>
          <Card className="bg-white overflow-hidden p-6 rounded-lg shadow-sm border-gray-200">
            <div className="font-[arial,sans-serif] text-[14px]">
              
              {/* URL & Breadcrumb */}
              <div className="flex items-center text-[#202124] text-[14px] leading-tight mb-1">
                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                  {hostname !== 'example.com' ? (
                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=32`} alt="Favicon" className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[#202124] text-[14px]">{hostname}</span>
                  <span className="text-[#4d5156] text-[12px] mt-0.5">{truncatedUrl}</span>
                </div>
              </div>
              
              {/* Title */}
              <a href="#" className="group block mb-1">
                <h3 className="text-[#1a0dab] group-hover:underline text-[20px] leading-[1.3] font-normal m-0 p-0 break-words max-w-[600px]">
                  {truncatedTitle || 'Please enter a title'}
                </h3>
              </a>

              {/* Rich Snippets (Stars) */}
              {showStars && (
                <div className="flex items-center text-[14px] text-[#70757a] mb-1">
                  <span className="text-[#fbbc04] mr-1">
                    {'★'.repeat(Math.round(Number(rating)))}{'☆'.repeat(5 - Math.round(Number(rating)))}
                  </span>
                  <span>Rating: {rating} · {votes} votes</span>
                </div>
              )}

              {/* Description */}
              <div className="text-[#4d5156] text-[14px] leading-[1.58] max-w-[600px] break-words">
                {showDate && <span className="text-[#70757a] font-bold mr-1">{dateStr} —</span>}
                <span>{truncatedDesc}</span>
              </div>

            </div>
          </Card>
          
          <div className="mt-8 text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
            <h4 className="font-semibold text-foreground mb-2">Why Pixel Width?</h4>
            <p className="mb-2">
              Google truncates SERP snippets based on the actual pixel width of characters, not strict character counts. For example, a "W" is much wider than an "i". 
            </p>
            <p>
              This simulator accurately estimates widths: ~600px for titles and ~960px for descriptions (roughly two lines of text).
            </p>
          </div>
        </div>
        
      </div>
    </ToolShell>
  );
}
