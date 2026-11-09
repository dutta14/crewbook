import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface QRCodeProps {
  /** The whole link; the code carries all of it, so it holds the same data the link does. */
  url: string;
  size?: number;
}

const QUIET_ZONE = 4;

/** Returns null when the text is too long for any QR code. */
function buildPath(url: string): { path: string; modules: number } | null {
  try {
    const code = qrcode(0, 'L');
    code.addData(url, 'Byte');
    code.make();
    const count = code.getModuleCount();
    let path = '';
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) {
          path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
        }
      }
    }
    return { path, modules: count + QUIET_ZONE * 2 };
  } catch {
    return null;
  }
}

/** Always dark on white, whatever the theme, so scanners can read it. */
export function QRCode({ url, size = 160 }: QRCodeProps) {
  const built = useMemo(() => buildPath(url), [url]);

  if (built === null) {
    return (
      <p className="share-qr__unavailable" role="status">
        This link is too long for a QR code. Copy the link instead.
      </p>
    );
  }

  return (
    <svg
      className="share-qr__code"
      role="img"
      aria-label={`QR code linking to ${url}`}
      width={size}
      height={size}
      viewBox={`0 0 ${built.modules} ${built.modules}`}
      shapeRendering="crispEdges"
    >
      <rect width={built.modules} height={built.modules} fill="#ffffff" />
      <path d={built.path} fill="#000000" />
    </svg>
  );
}
