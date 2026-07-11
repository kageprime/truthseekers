"use client";

import { useState } from "react";

const SIZES = { sm: 24, md: 32, lg: 40, xl: 48 };

interface AvatarProps {
  src?: string;
  alt: string;
  initials?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

function stringToColor(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 45%, 50%)`;
}

export default function Avatar({ src, alt, initials, size = "md", className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dim = SIZES[size];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        width={dim}
        height={dim}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: dim, height: dim }}
      />
    );
  }

  const text = initials || alt.slice(0, 2).toUpperCase();
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-medium ${className}`}
      style={{
        width: dim,
        height: dim,
        background: stringToColor(alt),
        color: "#fff",
        fontSize: dim * 0.4,
        lineHeight: 1,
      }}
      title={alt}
    >
      {text}
    </div>
  );
}
