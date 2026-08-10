import React, { useMemo } from "react";
import QRCode from "qrcode";

interface QRDisplayProps {
  payload: string;
  className?: string;
  size?: number;
  instruction?: string;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({
  payload,
  className = "",
  size = 256,
  instruction,
}) => {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(payload, {
          width: Math.max(256, size),
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    };

    generateQR();
  }, [payload, size]);

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR Code"
          width={size}
          height={size}
          className="border-4 border-gray-300 rounded-lg bg-white"
          style={{ imageRendering: "crisp-edges" }}
        />
      )}
      {instruction && (
        <p className="text-center text-lg font-semibold text-blue-600 max-w-sm">
          {instruction}
        </p>
      )}
    </div>
  );
};

export default QRDisplay;
