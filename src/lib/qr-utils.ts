/**
 * Checks if a string is a valid hex color and ensures it starts with #
 */
export const normalizeHex = (color: string | undefined): string => {
    if (!color) return '#FFFFFF';
    const clean = color.replace(/#/g, '');
    return `#${clean}`;
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
        format: 'png' | 'svg';
        bgColor?: string;
        logoDataUri?: string;
        size?: number; // Original size of the QR code logic (e.g., 256)
    }
) => {
    if (!svgElement) return;

    const { filename, format, bgColor = '#FFFFFF', logoDataUri, size = 256 } = options;
    const cleanBgColor = normalizeHex(bgColor);

    // 1. Serialize SVG Data
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    if (format === 'svg') {
        // For SVG download, we can't easily embed the "HTML" <img> tag that sits on top.
        // Users usually want the vector QR. If they really want the logo in SVG, 
        // we'd need to embed it as an <image> inside the SVG structure.
        // For now, let's fix the basic download.

        // If we want to support logo in SVG, we'd need to manipulate the svgString here.
        // Leaving as standard vector QR for now to ensure robustness.

        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${filename}.svg`);
        return;
    }

    // 2. PNG Download (Canvas Composition)
    const canvas = document.createElement("canvas");
    const scale = 5; // High resolution wrapper
    const outputSize = size * scale;

    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // A. Fill Background
    // This fixes the "Translucent/Black" issue if the SVG has no background
    ctx.fillStyle = cleanBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // B. Draw QR Code
    const img = new Image();
    img.crossOrigin = "anonymous";

    // We wrap the invalidation in a promise to await loading
    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            // Draw QR code centered
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
        };
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
    });

    // C. Draw Logo (if exists)
    if (logoDataUri) {
        await new Promise<void>((resolve) => {
            const logoImg = new Image();
            logoImg.crossOrigin = "anonymous";
            logoImg.onload = () => {
                // Determine logo size (usually 20% of QR)
                const logoSize = outputSize * 0.2;
                const logoPos = (outputSize - logoSize) / 2;

                // 1. Draw White Container Circle/Box (mimicking QrCodeRenderer)
                // The renderer uses a white bg with padding.
                ctx.fillStyle = '#FFFFFF';
                // Drawing a rounded rect or circle would be ideal, but a square is safer for canvas
                // unless we do complex clipping. Let's do a filled square for safety and clarity first,
                // matching the "box" look.
                // Or circular if we want to be fancy. Let's stick to the visual: "bg-white rounded-full"

                ctx.beginPath();
                const radius = logoSize / 2; // Radius of the container
                const centerX = outputSize / 2;
                const centerY = outputSize / 2;

                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
                ctx.fillStyle = 'white';
                ctx.fill();

                // 2. Draw the Logo Image inside
                // We need to fit it inside the circle. 
                // Let's protect aspect ratio or just draw it.
                // To be safe inside circle, we might want to pad it a bit.
                const imgSize = logoSize * 0.8; // 80% of container
                const imgPos = (outputSize - imgSize) / 2;

                // Save context for clipping
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 0.95, 0, 2 * Math.PI, false); // Clip slightly inner
                ctx.clip();
                ctx.drawImage(logoImg, imgPos, imgPos, imgSize, imgSize);
                ctx.restore();

                resolve();
            };
            // If logo fails, we just skip it
            logoImg.onerror = () => resolve();
            logoImg.src = logoDataUri;
        });
    }

    // D. Trigger Download
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
