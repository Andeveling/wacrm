import type { PresenceStatus } from '@/lib/presence';
import { cn } from '@/lib/utils';

// Single source of truth for presence colours. Semantic accents
// (emerald / amber / muted), mirroring the role-chip palette already
// used across settings, so they're intentionally not tokenized.
export const PRESENCE_DOT_CLASS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  offline: 'bg-muted-foreground/50',
};

/**
 * A small presence dot. Used inline (e.g. the inbox Assign dropdown)
 * and, with `asAvatarBadge`-style positioning supplied via className,
 * layered onto an avatar. `label` powers the native title/aria for
 * the lightweight inline case; the roster wraps it in a real Tooltip.
 */
export function PresenceDot({ status, label, className }: { status: PresenceStatus; label?: string; className?: string }) {
  // role="img" is unconditional so biome's static analyzer recognises
  // aria-label as valid for the element. When no label is supplied,
  // the dot is decorative and `aria-label` is undefined (omitted).
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-block size-2 shrink-0 rounded-full', PRESENCE_DOT_CLASS[status], className)}
    />
  );
}
