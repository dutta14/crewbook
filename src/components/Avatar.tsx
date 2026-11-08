import { useState } from 'react';
import '../styles/avatar.css';
import { getAvatarColor, getInitials } from '../utils/avatarColor';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  /** Shown instead of the initials. Only https: and data:image/ URLs are accepted. */
  avatarUrl?: string;
  /** Hide the avatar from assistive technology when the name is already rendered beside it. */
  'aria-hidden'?: boolean;
}

export const AVATAR_SIZES: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 12 },
  md: { box: 40, font: 14 },
  lg: { box: 64, font: 22 },
};

const SAFE_URL_PATTERN =
  /^(https:\/\/\S+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/i;

function safeImageUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  return trimmed && SAFE_URL_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function Avatar({ name, size = 'md', avatarUrl, 'aria-hidden': ariaHidden }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl = safeImageUrl(avatarUrl);
  const showImage = imageUrl !== undefined && imageUrl !== failedUrl;
  const label = name.trim() || 'Unknown';
  const { box, font } = AVATAR_SIZES[size];
  const a11y = ariaHidden ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };

  return (
    <span
      className={`avatar avatar--${size}`}
      style={{
        width: box,
        height: box,
        fontSize: font,
        backgroundColor: getAvatarColor(name.trim()),
      }}
      {...a11y}
    >
      {showImage ? (
        <img
          className="avatar__img"
          src={imageUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}
