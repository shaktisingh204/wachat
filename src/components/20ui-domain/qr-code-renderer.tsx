import QRCode from 'react-qr-code';

interface QrCodesRendererProps {
    value: string;
    size?: number;
    fgColor?: string;
    bgColor?: string;
    level?: string;
    logoDataUri?: string;
}

export function QrCodeRenderer({
    value,
    size = 256,
    fgColor = '#000000',
    bgColor = '#FFFFFF',
    level = 'L',
    logoDataUri
}: QrCodesRendererProps) {
    if (!value) return null;

    return (
        <div
            className="relative inline-block p-4 rounded-[var(--st-radius)]"
            style={{ backgroundColor: bgColor }}
        >
            <QRCode
                value={value}
                size={size}
                fgColor={fgColor}
                bgColor={bgColor}
                level={level as any}
                className="h-auto w-full max-w-full"
            />
            {logoDataUri && (
                <div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-[var(--st-bg)] rounded-full overflow-hidden shadow-sm"
                    style={{ width: size * 0.2, height: size * 0.2 }}
                >
                    <img
                        src={logoDataUri}
                        alt="QR code logo"
                        className="w-full h-full object-contain p-1"
                    />
                </div>
            )}
        </div>
    );
}
