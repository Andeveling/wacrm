'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface ContactsPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ContactsPagination({ page, totalPages, totalCount, pageSize, hasPrev, hasNext, onPrev, onNext }: ContactsPaginationProps) {
  const t = useTranslations('Contacts.page');

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-xs">
        {t('showingPagination', {
          start: page * pageSize + 1,
          end: Math.min((page + 1) * pageSize, totalCount),
          total: totalCount,
        })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasPrev}
          onClick={onPrev}
          className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-muted-foreground text-xs">{t('pageCount', { page: page + 1, total: totalPages })}</span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasNext}
          onClick={onNext}
          className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
