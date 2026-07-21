'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function ContactsError({ unstable_retry }: { unstable_retry: () => void }) {
  const t = useTranslations('Contacts.page');

  return (
    <div className="rounded-lg border border-destructive/50 p-6 text-center">
      <p className="text-muted-foreground text-sm">{t('loadError')}</p>
      <Button className="mt-4" onClick={unstable_retry}>
        {t('retry')}
      </Button>
    </div>
  );
}
