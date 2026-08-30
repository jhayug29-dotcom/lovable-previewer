"use client";

/**
 * Overlapping avatar stack — adapted from the Magic UI `avatar-circles` demo.
 * Borders use the surrounding background token so the ring reads cleanly on the
 * dark landing. Hovering an avatar lifts it slightly for a little life.
 */

import { cn } from "@/lib/utils";

export interface AvatarCirclesItem {
  imageUrl: string;
  profileUrl?: string;
}

export interface AvatarCirclesProps {
  className?: string;
  /** Optional "+N" bubble appended after the avatars. */
  numPeople?: number;
  avatarUrls: AvatarCirclesItem[];
}

export function AvatarCircles({ numPeople, className, avatarUrls }: AvatarCirclesProps) {
  return (
    <div className={cn("z-10 flex -space-x-2.5", className)}>
      {avatarUrls.map((avatar, i) => {
        const img = (
          <img
            className="h-8 w-8 rounded-full border-2 border-background object-cover transition-transform duration-300 hover:-translate-y-0.5"
            src={avatar.imageUrl}
            width={32}
            height={32}
            alt={`Avatar ${i + 1}`}
            loading="lazy"
            decoding="async"
          />
        );
        return avatar.profileUrl ? (
          <a
            key={i}
            href={avatar.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="relative"
          >
            {img}
          </a>
        ) : (
          <span key={i} className="relative">
            {img}
          </span>
        );
      })}
      {typeof numPeople === "number" && numPeople > 0 && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-foreground text-[0.62rem] font-semibold text-background">
          +{numPeople}
        </span>
      )}
    </div>
  );
}
