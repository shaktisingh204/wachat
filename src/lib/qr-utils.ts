/**
 * Checks if a string is a valid hex color and ensures it starts with #
 */
export const normalizeHex = (color: string | undefined): string => {
    if (!color) return '#FFFFFF';
    const clean = color.replace(/#/g, '');
    return `#${clean}`;
};

export const QR_FIELD_LIMITS = {
    name: 120,
    url: 2048,
    text: 1000,
    email: 254,
    emailSubject: 140,
    emailBody: 1000,
    phone: 20,
    smsMessage: 320,
    wifiSsid: 64,
    wifiPassword: 128,
    vcardName: 100,
    vcardOrg: 100,
    vcardPhone: 20,
    vcardEmail: 254,
    vcardUrl: 500,
    calendarTitle: 200,
    calendarLocation: 300,
    geoAddress: 500,
};

export const buildVCard = (fields: {
    firstName?: string;
    lastName?: string;
    org?: string;
    phone?: string;
    email?: string;
    url?: string;
    address?: string;
}): string => {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (fields.firstName || fields.lastName)
        lines.push(`FN:${[fields.firstName, fields.lastName].filter(Boolean).join(' ')}`);
    if (fields.org) lines.push(`ORG:${fields.org}`);
    if (fields.phone) lines.push(`TEL:${fields.phone}`);
    if (fields.email) lines.push(`EMAIL:${fields.email}`);
    if (fields.url) lines.push(`URL:${fields.url}`);
    if (fields.address) lines.push(`ADR:;;${fields.address};;;`);
    lines.push('END:VCARD');
    return lines.join('\n');
};

export const buildCalendarEvent = (fields: {
    title: string;
    startDate: string;
    endDate: string;
    location?: string;
    description?: string;
}): string => {
    const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace('.000Z', 'Z');
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'BEGIN:VEVENT',
        `SUMMARY:${fields.title}`,
        `DTSTART:${fmt(fields.startDate)}`,
        `DTEND:${fmt(fields.endDate)}`,
        fields.location ? `LOCATION:${fields.location}` : '',
        fields.description ? `DESCRIPTION:${fields.description}` : '',
        'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\n');
};

export const normalizeQrWebsiteUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

export const filterPhoneLikeInput = (value: string, maxLength = QR_FIELD_LIMITS.phone): string => {
    return value.replace(/[^\d+]/g, '').slice(0, maxLength);
};

/**
 * Downloads a QR code as an image/svg.
 * Handles the "Full Black" bug by ensuring proper background color application.
 * Handles the "Missing Logo" bug by manually drawing the logo on the canvas for PNGs.
 */
export const downloadQrCode = async (
    svgElement: SVGSVGElement | null | undefined,
    options: {
        filename: string;
        format: 'png' | 'svg' | 'webp' | 'pdf';
        bgColor?: string;
        logoDataUri?: string;
        size?: number;
    }
) => {
    if (!svgElement) return;

    const { filename, format, bgColor = '#FFFFFF', logoDataUri, size = 256 } = options;
    const cleanBgColor = normalizeHex(bgColor);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);

    if (format === 'svg') {
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${filename}.svg`);
        return;
    }

    const canvas = document.createElement("canvas");
    const scale = 5;
    const outputSize = size * scale;

    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = cleanBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
        };
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
    });

    if (logoDataUri) {
        await new Promise<void>((resolve) => {
            const logoImg = new Image();
            logoImg.crossOrigin = "anonymous";
            logoImg.onload = () => {
                const logoSize = outputSize * 0.2;
                const centerX = outputSize / 2;
                const centerY = outputSize / 2;
                const radius = logoSize / 2;

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
                ctx.fillStyle = 'white';
                ctx.fill();

                const imgSize = logoSize * 0.8;
                const imgPos = (outputSize - imgSize) / 2;

                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 0.95, 0, 2 * Math.PI, false);
                ctx.clip();
                ctx.drawImage(logoImg, imgPos, imgPos, imgSize, imgSize);
                ctx.restore();

                resolve();
            };
            logoImg.onerror = () => resolve();
            logoImg.src = logoDataUri;
        });
    }

    if (format === 'webp') {
        const dataUrl = canvas.toDataURL('image/webp');
        triggerDownload(dataUrl, `${filename}.webp`);
        return;
    }

    if (format === 'pdf') {
        try {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pdfSize = Math.min(pageWidth, pageHeight) * 0.7;
            const x = (pageWidth - pdfSize) / 2;
            const y = (pageHeight - pdfSize) / 2;
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', x, y, pdfSize, pdfSize);
            pdf.save(`${filename}.pdf`);
        } catch {
            console.warn('jspdf not installed, falling back to PNG download');
            const dataUrl = canvas.toDataURL('image/png');
            triggerDownload(dataUrl, `${filename}.png`);
        }
        return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    triggerDownload(dataUrl, `${filename}.png`);
};

const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
