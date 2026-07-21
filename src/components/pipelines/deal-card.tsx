'use client';

import { Calendar, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/currency';
import type { Deal, PipelineStage } from '@/types';

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || '?').trim();
  if (!source) return '?';
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const t = useTranslations('Pipelines.card');
  const contactLabel = deal.contact?.name || deal.contact?.phone || t('noContact');
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-border/50 bg-muted/70 py-3 pr-3 pl-4 text-left shadow-sm transition-all ${
        isOverlay ? 'shadow-xl' : 'hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg'
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span aria-hidden className="absolute top-0 left-0 h-full w-1 rounded-l-xl" style={{ backgroundColor: stage?.color ?? '#94a3b8' }} />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 break-words font-semibold text-foreground text-sm leading-snug">{deal.title}</h4>
        {deal.status === 'won' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-[10px] text-primary">
            <Check className="h-3 w-3" />
            {t('won')}
          </span>
        )}
        {deal.status === 'lost' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-[10px] text-red-400">
            <X className="h-3 w-3" />
            {t('lost')}
          </span>
        )}
      </div>

      {/* Contact row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-semibold text-[10px] text-foreground">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span className="truncate text-muted-foreground text-xs">{contactLabel}</span>
        {deal.contact?.archived_at && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-semibold text-[10px] text-amber-600 dark:text-amber-400">
            {t('archived')}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-bold text-primary text-sm">{formatCurrency(deal.value, deal.currency)}</span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 font-semibold text-[10px] text-primary"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
}
