'use client';

import { Archive, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';

import type { ContactStatus } from '../_hooks/use-contacts';

interface ContactsBulkBarProps {
  count: number;
  status: ContactStatus;
  canEdit: boolean;
  onClear: () => void;
  onArchiveOrRestore: () => void;
}

export function ContactsBulkBar({ count, status, canEdit, onClear, onArchiveOrRestore }: ContactsBulkBarProps) {
  const t = useTranslations('Contacts.page');

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
      <p className="text-foreground text-sm">{t('selectedCount', { count })}</p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-foreground">
          {t('clearSelection')}
        </Button>
        <GatedButton
          variant={status === 'active' ? 'destructive' : 'outline'}
          size="sm"
          canAct={canEdit}
          gateReason={`${status} contacts`}
          onClick={onArchiveOrRestore}
        >
          {status === 'active' ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
          {t(status === 'active' ? 'archiveSelected' : 'restoreSelected')}
        </GatedButton>
      </div>
    </div>
  );
}
