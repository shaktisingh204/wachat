'use client';

import { useState } from 'react';
import EXIF from 'exif-js';
import { MapPin, ImageIcon, ExternalLink } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Table,
  TBody,
  Tr,
  Th,
  Td,
  Button,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton, type SabFilePick } from '@/components/sabfiles';
import { fmtDate } from '@/lib/utils';

import { ToolShell } from '@/components/seo-tools/tool-shell';

interface BasicInfo {
  name: string;
  size: number;
  type: string;
  lastModified: string;
  width: number;
  height: number;
}

function formatGPS(latArr: any, latRef: string, lonArr: any, lonRef: string): string | null {
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
  const { toast } = useToast();
  const [data, setData] = useState<BasicInfo | null>(null);
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);
  const [gpsData, setGpsData] = useState<string | null>(null);

  const onFile = (file: File, pick: SabFilePick) => {
    // Reset previous data
    setData(null);
    setExifData(null);
    setGpsData(null);

    const img = new Image();
    img.onload = () => {
      setData({
        name: file.name || pick.name,
        size: file.size,
        type: file.type || pick.mime || 'unknown',
        lastModified: fmtDate(new Date(file.lastModified || Date.now())),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      toast.error('Could not read that image. Try a different file.');
    };
    img.src = URL.createObjectURL(file);

    // Extract EXIF data using ArrayBuffer directly to avoid browser File parsing issues
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;
      try {
        const allTags: any = EXIF.readFromBinaryFile(buffer);
        if (!allTags || typeof allTags !== 'object') return;

        const filteredTags: Record<string, any> = {};

        // Filter out maker notes and thumbnails which can be huge arrays
        Object.keys(allTags).forEach((key) => {
          if (key !== 'MakerNote' && key !== 'thumbnail' && key !== 'userComment') {
            if (Array.isArray(allTags[key]) && allTags[key].length > 10) return;
            filteredTags[key] = allTags[key];
          }
        });

        if (Object.keys(filteredTags).length > 0) {
          setExifData(filteredTags);
        }

        const lat = allTags.GPSLatitude;
        const lon = allTags.GPSLongitude;
        const latRef = allTags.GPSLatitudeRef;
        const lonRef = allTags.GPSLongitudeRef;

        const coords = formatGPS(lat, latRef, lon, lonRef);
        if (coords) {
          setGpsData(coords);
        }
      } catch (err) {
        console.error('EXIF extraction error', err);
        toast.error('Could not extract metadata from that image.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <ToolShell
      title="Image Metadata Viewer"
      description="Detailed metadata extraction, including EXIF and GPS tags."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose an image</CardTitle>
            <CardDescription>
              Pick a JPEG, PNG, WebP, HEIC, or AVIF from your SabFiles library to inspect its
              metadata.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <SabFileToFileButton
              accept="image"
              variant="default"
              onPickFile={onFile}
              onError={() => toast.error('Could not load that file from SabFiles.')}
            >
              {data ? 'Choose another image' : 'Choose image'}
            </SabFileToFileButton>
          </CardBody>
        </Card>

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic information</CardTitle>
              </CardHeader>
              <CardBody>
                <Table density="compact">
                  <TBody>
                    <Tr>
                      <Th scope="row" className="text-[var(--st-text-secondary)]">
                        Name
                      </Th>
                      <Td align="right" truncate title={data.name}>
                        {data.name}
                      </Td>
                    </Tr>
                    <Tr>
                      <Th scope="row" className="text-[var(--st-text-secondary)]">
                        Type
                      </Th>
                      <Td align="right">{data.type}</Td>
                    </Tr>
                    <Tr>
                      <Th scope="row" className="text-[var(--st-text-secondary)]">
                        Size
                      </Th>
                      <Td align="right">{(data.size / 1024).toFixed(1)} KB</Td>
                    </Tr>
                    <Tr>
                      <Th scope="row" className="text-[var(--st-text-secondary)]">
                        Dimensions
                      </Th>
                      <Td align="right">
                        {data.width} x {data.height} px
                      </Td>
                    </Tr>
                    <Tr>
                      <Th scope="row" className="text-[var(--st-text-secondary)]">
                        Last modified
                      </Th>
                      <Td align="right">{data.lastModified}</Td>
                    </Tr>
                  </TBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GPS data (Local SEO)</CardTitle>
              </CardHeader>
              <CardBody>
                {gpsData ? (
                  <div className="space-y-3">
                    <Table density="compact">
                      <TBody>
                        <Tr>
                          <Th scope="row" className="text-[var(--st-text-secondary)]">
                            Coordinates
                          </Th>
                          <Td align="right">{gpsData}</Td>
                        </Tr>
                      </TBody>
                    </Table>
                    <Button
                      variant="outline"
                      size="sm"
                      iconRight={ExternalLink}
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${gpsData}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      View on Google Maps
                    </Button>
                  </div>
                ) : (
                  <EmptyState
                    icon={MapPin}
                    title="No GPS metadata"
                    description="This image has no embedded location tags."
                    size="sm"
                  />
                )}
              </CardBody>
            </Card>

            {exifData && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Detailed EXIF data</CardTitle>
                </CardHeader>
                <CardBody>
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
                          displayValue = value
                            .map((v) => (typeof v === 'object' && v !== null ? v.toString() : v))
                            .join(', ');
                        } else {
                          try {
                            displayValue = JSON.stringify(value);
                          } catch (e) {
                            displayValue = 'Object';
                          }
                        }
                      }

                      // Skip completely empty values or overly long ones (just in case)
                      if (!displayValue || displayValue.length > 100) return null;

                      return (
                        <div
                          key={key}
                          className="flex flex-col border-b border-[var(--st-border)] pb-1 mb-1"
                        >
                          <span className="font-semibold text-[var(--st-text-secondary)] text-xs">
                            {key}
                          </span>
                          <span
                            className="font-medium truncate text-[var(--st-text)]"
                            title={displayValue}
                          >
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {!data && (
          <EmptyState
            icon={ImageIcon}
            title="No image selected yet"
            description="Choose an image above to view its dimensions, EXIF tags, and GPS location."
          />
        )}
      </div>
    </ToolShell>
  );
}
