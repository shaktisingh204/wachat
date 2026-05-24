'use client';

import { Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import EXIF from 'exif-js';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

function formatGPS(latArr: any, latRef: string, lonArr: any, lonRef: string) {
  if (!latArr || !lonArr || !latRef || !lonRef) return null;
  try {
    const lat = latArr[0].valueOf() + latArr[1].valueOf() / 60 + latArr[2].valueOf() / 3600;
    const lon = lonArr[0].valueOf() + lonArr[1].valueOf() / 60 + lonArr[2].valueOf() / 3600;
    
    const finalLat = (latRef === 'S' ? -lat : lat).toFixed(6);
    const finalLon = (lonRef === 'W' ? -lon : lon).toFixed(6);
    return `${finalLat}, ${finalLon}`;
  } catch (e) {
    return null;
  }
}

export default function ImageMetadataPage() {
  const [data, setData] = useState<any>(null);
  const [exifData, setExifData] = useState<any>(null);
  const [gpsData, setGpsData] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous data
    setData(null);
    setExifData(null);
    setGpsData(null);

    const img = new Image();
    img.onload = () => {
      setData({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toLocaleString(),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);

    // Extract EXIF data
    EXIF.getData(file as any, function(this: any) {
      const allTags = EXIF.getAllTags(this);
      
      const filteredTags: any = {};
      
      // Filter out maker notes and thumbnails which can be huge arrays
      Object.keys(allTags).forEach(key => {
        if (key !== 'MakerNote' && key !== 'thumbnail' && key !== 'userComment') {
          if (Array.isArray(allTags[key]) && allTags[key].length > 10) return;
          filteredTags[key] = allTags[key];
        }
      });
      
      if (Object.keys(filteredTags).length > 0) {
        setExifData(filteredTags);
      }

      const lat = EXIF.getTag(this, "GPSLatitude");
      const lon = EXIF.getTag(this, "GPSLongitude");
      const latRef = EXIF.getTag(this, "GPSLatitudeRef");
      const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

      const coords = formatGPS(lat, latRef, lon, lonRef);
      if (coords) {
        setGpsData(coords);
      }
    });
  };

  return (
    <ToolShell title="Image Metadata Viewer" description="Detailed metadata extraction, including EXIF and GPS tags.">
      <div className="space-y-6">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/avif" onChange={onFile} className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100" />
        
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ZoruCardContent className="p-4 space-y-2 text-sm">
                <h3 className="font-bold text-lg mb-4">Basic Information</h3>
                <div className="flex justify-between border-b pb-1"><span className="font-semibold text-muted-foreground">Name</span> <span className="font-medium truncate max-w-[200px]" title={data.name}>{data.name}</span></div>
                <div className="flex justify-between border-b pb-1"><span className="font-semibold text-muted-foreground">Type</span> <span className="font-medium">{data.type}</span></div>
                <div className="flex justify-between border-b pb-1"><span className="font-semibold text-muted-foreground">Size</span> <span className="font-medium">{(data.size / 1024).toFixed(1)} KB</span></div>
                <div className="flex justify-between border-b pb-1"><span className="font-semibold text-muted-foreground">Dimensions</span> <span className="font-medium">{data.width} × {data.height}</span></div>
                <div className="flex justify-between border-b pb-1"><span className="font-semibold text-muted-foreground">Last modified</span> <span className="font-medium">{data.lastModified}</span></div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardContent className="p-4 space-y-2 text-sm">
                <h3 className="font-bold text-lg mb-4">GPS Data (Local SEO)</h3>
                {gpsData ? (
                  <>
                    <div className="flex justify-between border-b pb-1">
                      <span className="font-semibold text-muted-foreground">Coordinates</span>
                      <span className="font-medium">{gpsData}</span>
                    </div>
                    <div className="pt-2">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${gpsData}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                        View on Google Maps
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic py-4">No GPS metadata found in this image.</div>
                )}
              </ZoruCardContent>
            </Card>

            {exifData && (
              <Card className="md:col-span-2">
                <ZoruCardContent className="p-4 text-sm">
                  <h3 className="font-bold text-lg mb-4">Detailed EXIF Data</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    {Object.entries(exifData).map(([key, value]) => {
                      // Some values might be objects (like Number objects from exif-js) or Uint8Arrays
                      let displayValue = String(value);
                      if (typeof value === 'object' && value !== null) {
                        if (value instanceof String) {
                          displayValue = value.toString();
                        } else if (value instanceof Number) {
                          displayValue = value.toString();
                        } else if (Array.isArray(value)) {
                          displayValue = value.map(v => typeof v === 'object' && v !== null ? v.toString() : v).join(', ');
                        } else {
                          try {
                            displayValue = JSON.stringify(value);
                          } catch(e) {
                            displayValue = 'Object';
                          }
                        }
                      }
                      
                      // Skip completely empty values or overly long ones (just in case)
                      if (!displayValue || displayValue.length > 100) return null;

                      return (
                        <div key={key} className="flex flex-col border-b pb-1 mb-1">
                          <span className="font-semibold text-muted-foreground text-xs">{key}</span>
                          <span className="font-medium truncate" title={displayValue}>{displayValue}</span>
                        </div>
                      );
                    })}
                  </div>
                </ZoruCardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  );
}
